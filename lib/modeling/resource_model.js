/**
 * Define resource model
 * @function resourceModel
 * @param {function} define - Definer
 * @returns {Object} Defined model
 */
'use strict'

const co = require('co')
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
      ofName (name) {
        return co(function * () {
          while (Resource._cacheWorking[ name ]) {
            yield asleep(5)
          }
          let cached = Resource.getCacheForName(name)
          if (cached) {
            return cached
          }
          Resource._cacheWorking[ name ] = true
          let [ resource ] = yield Resource.findOrCreate({
            where: { name },
            defaults: { name }
          })
          Resource.setCacheForName(name, resource)
          Resource._cacheWorking[ name ] = false
          return resource
        }).catch((e) => {
          Resource._cacheWorking[ name ] = false
          return Promise.reject(e)
        })
      }
    }
  })
  Resource._cacheWorking = {}
  Resource._cache = {}
  Resource._cacheClearTimer = null
  return Resource
}

module.exports = resourceModel
