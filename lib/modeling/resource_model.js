/**
 * Define resource model
 * @function resourceModel
 * @param {function} define - Definer
 * @returns {Object} Defined model
 */
'use strict'

const {STRING} = require('sequelize')
const asleep = require('asleep')
const LRU = require('lru-cache')

/** @lends resourceModel */
function resourceModel ({db}) {
  const Resource = db.define('Resource', {
    name: {
      comment: 'Name space string',
      type: STRING,
      allowNull: false,
      unique: true
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['name']
      }
    ],
    classMethods: {
      getCacheForName (name) {
        return Resource.nameCache.get(name)
      },
      setCacheForName (name, resource) {
        Resource.nameCache.set(name, resource)
      },
      clearCacheForName (name) {
        Resource.nameCache.del(name)
      },
      async ofName (name) {
        const cached = Resource.getCacheForName(name)
        if (cached) {
          return cached
        }
        if (Resource._cacheWorking[name]) {
          await Promise.resolve(Resource._cacheWorking[name])
          return Resource.ofName(name)
        }
        return Resource._cacheWorking[name] = (async () => {
          try {
            const [resource] = await Resource.findOrCreate({
              where: {name},
              defaults: {name}
            })
            Resource.setCacheForName(name, resource)
            return resource
          } finally {
            Resource._cacheWorking[name] = null
          }
        })()
      }
    }
  })

  Resource._cacheWorking = {}
  Resource.nameCache = LRU({
    max: 100,
    maxAge: 3 * 1000
  })
  return Resource
}

module.exports = resourceModel
