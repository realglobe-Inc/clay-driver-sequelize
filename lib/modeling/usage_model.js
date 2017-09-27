/**
 * Define usage model
 * @function usageModel
 * @returns {Object} Defined model
 */
'use strict'

const {STRING, TEXT, BLOB} = require('sequelize')

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
                       db
                     }) {
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
      allowNull: true
    }
  }, {
    classMethods: {
      push (resourceName, kind, keys) {
        Usage.queue.push([resourceName, kind, keys])
      },
      async flush () {
        const flushing = {}
        while (Usage.queue.length > 0) {
          const [resource, kind, keys] = Usage.queue.shift()
          flushing[resource] = flushing[resource] || {}
          flushing[resource][kind] = flushing[resource][kind] || {}
          for (const key of keys) {
            flushing[resource][kind][key] = (flushing[resource][kind][key] || 0) + 1
          }
        }
        for (const resource of Object.keys(flushing)) {
          for (const kind of Object.keys(flushing[resource])) {
            const [entity] = await Usage.findOrCreate({
              where: {resource, kind},
              defaults: {resource, kind}
            })
            const adding = flushing[resource][kind]
            const current = JSON.parse(entity[kind] || '{}')
            await entity.update({
              counts: JSON.stringify(sumCounts(current, adding))
            })
          }
        }
      }
    }
  })

  Usage.queue = []

  return Usage
}

module.exports = usageModel

