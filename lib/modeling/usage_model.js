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
      allowNull: true,
      default: () => '{}'
    }
  }, {
    classMethods: {
      push (resourceName, kind, keys) {
        Usage.queue.push([resourceName, kind, keys])
      },
      async flush () {
        if (Usage.isFlushing) {
          return
        }
        if (db.closed) {
          return
        }
        Usage.isFlushing = true
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
            if (db.closed) {
              return
            }
            try {
              const [entity] = await Usage.findOrCreate({
                where: {resource, kind},
                defaults: {resource, kind}
              })
              const adding = flushing[resource][kind]
              const current = JSON.parse(entity[kind] || '{}')
              await entity.update({
                counts: JSON.stringify(sumCounts(current, adding))
              })
            } catch (e) {
              console.warn('[ClayDriverSequelize] Failed to flush usage metrics')
            }
          }
        }
        Usage.isFlushing = false
      },
      async countsOf (resourceName) {
        const usages = await Usage.findAll({where: {resource: resourceName}})
        return usages
          .filter((usage) => usage.resource === resourceName)
          .reduce((result, {kind, counts}) => {
            result[kind] = JSON.parse(counts || '{}')
            return result
          }, {})
      }
    }
  })

  Usage.queue = []
  Usage.isFlushing = false

  return Usage
}

module.exports = usageModel

