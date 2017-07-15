/**
 * Define resource model
 * @function resourceModel
 * @param {function} define - Definer
 * @returns {Object} Defined model
 */
'use strict'

const { STRING } = require('sequelize')
const asleep = require('asleep')

/** @lends resourceModel */
function resourceModel ({ db }) {
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
        fields: [ 'name' ]
      }
    ],
    classMethods: {
      getCacheForName (name) {
        return Resource._cache[ name ]
      },
      setCacheForName (name, resource) {
        clearTimeout(Resource._cacheClearTimer)
        Resource._cache[ name ] = resource
        Resource._cacheClearTimer = setTimeout(() =>
          Resource.clearCacheForName(name), 5 * 60 * 1000).unref()
      },
      clearCacheForName (name) {
        delete Resource._cache[ name ]
      },
      async ofName (name) {
        while (Resource._cacheWorking[ name ]) {
          await asleep(5)
        }
        const cached = Resource.getCacheForName(name)
        if (cached) {
          return cached
        }
        Resource._cacheWorking[ name ] = true
        try {
          const [ resource ] = await Resource.findOrCreate({
            where: { name },
            defaults: { name }
          })
          Resource.setCacheForName(name, resource)
          Resource._cacheWorking[ name ] = false
          return resource
        } finally {
          Resource._cacheWorking[ name ] = false
        }
      }
    }
  })
  Resource._cacheWorking = {}
  Resource._cache = {}
  Resource._cacheClearTimer = null
  return Resource
}

module.exports = resourceModel
