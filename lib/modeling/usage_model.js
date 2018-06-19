/**
 * Define usage model
 * @function usageModel
 * @returns {Object} Defined model
 */
'use strict'

const {STRING, TEXT, BLOB} = require('sequelize')
const path = require('path')
const {fromJSONFile, toJSONFile} = require('../helpers/file_access')

const sumCounts = (v1, v2) => {
  const result = {}
  for (const v of [v1, v2]) {
    for (const key of Object.keys(v)) {
      result[key] = (result[key] || 0) + v[key]
    }
  }
  return result
}

/** @lends usageModel */
function usageModel ({
                       db,
                       varDir,

                     }) {

  const usageFileNameFor = (resourceName) => path.join(varDir, 'usages', `usage-${resourceName}.json`)

  const Usage = db.define('Usage', {
    resource: {
      comment: 'Name of resource',
      type: STRING,
      allowNull: false
    },
    kind: {
      comment: 'Usage type',
      type: STRING,
      allowNull: true
    },
    counts: {
      comment: 'Usage counts',
      type: TEXT,
      allowNull: true,
      default: () => '{}'
    }
  }, {
    classMethods: {
      push (resourceName, kind, keys) {
        Usage.chunk[resourceName] = Usage.chunk[resourceName] || {}
        Usage.chunk[resourceName][kind] = Usage.chunk[resourceName][kind] || {}
        for (const key of keys) {
          Usage.chunk[resourceName][kind][key] = (Usage.chunk[resourceName][kind][key] || 0) + 1
        }
        {
          const WATER_MARK = 100
          const size = Object.keys(Usage.chunk[resourceName]).length
          const needsFlush = WATER_MARK <= size && (WATER_MARK % size === 0)
          if (needsFlush) {
            void Usage.flush()
          }
        }
      },
      async flush () {
        if (Usage.isFlushing) {
          return
        }
        if (db.closed) {
          return
        }
        Usage.isFlushing = true
        const chunk = Usage.chunk
        Usage.chunk = {}
        for (const resourceName of Object.keys(chunk)) {
          const filename = usageFileNameFor(resourceName)
          const adding = chunk[resourceName]
          const data = await fromJSONFile(filename) || {}
          for (const kind of Object.keys(adding)) {
            if (db.closed) {
              return
            }
            data[kind] = sumCounts(
              data[kind] || {},
              adding[kind] || {}
            )
          }
          try {
            await toJSONFile(filename, data)
          } catch (e) {
            console.warn('[ClayDriverSequelize] Failed to flush usage metrics')
            break
          }
        }
        Usage.isFlushing = false
      },
      async countsOf (resourceName) {
        const filename = usageFileNameFor(resourceName)
        return await fromJSONFile(filename) || {}
      }
    }
  })

  Usage.chunk = []
  Usage.isFlushing = false

  return Usage
}

module.exports = usageModel

