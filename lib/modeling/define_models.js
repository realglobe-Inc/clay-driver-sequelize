/**
 * Define sequelize models
 * @function defineModels
 * @param {Sequelize} db - A sequelize instance
 * @returns {Object} Defined models
 */
'use strict'

const Sequelize = require('sequelize')

const co = require('co')
const asleep = require('asleep')
const { STRING } = Sequelize
const { typeOf } = require('clay-serial')
const { serialize, deserialize } = require('./serializer')
const { parseFilter } = require('./parser')
const { normalizeSort, normalizeAttributeValues } = require('./normalizer')
const { buildWhereTerm, buildOrderTerm, buildSelectSQL, buildCountSQL } = require('./builder')
const { expand } = require('objnest')
const { get, set } = require('../helpers/attribute_access')
const LRU = require('lru-cache')

const ARRAY_LAST_INDEX_PATTERN = /(.*)(\[)([0-9]+)(\])$/

/** @lends defineModels */
function defineModels (db) {
  let define = (name, attributes, options = {}) => {
    const { classMethods = {}, instanceMethods = {} } = options
    const defined = db.define(name, attributes, Object.assign({}, options))
    Object.assign(defined, classMethods)
    Object.assign(defined.prototype, instanceMethods)
    return defined
  }

  const Resource = define('Resource', {
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

  const Entity = define('Entity', {
    cid: {
      comment: 'Clay id',
      type: STRING,
      allowNull: false
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: [ 'ResourceId', 'cid' ]
      }
    ],
    instanceMethods: {
      asClay () {
        const s = this
        let values = s.EntityAttributes.reduce((attributes, entityAttribute) => {
          const { name } = entityAttribute
          const isArray = ARRAY_LAST_INDEX_PATTERN.test(name)
          const value = entityAttribute.toValue()
          if (isArray) {
            let [ , arrayName, , index ] = name.match(ARRAY_LAST_INDEX_PATTERN)
            let array = get(attributes, arrayName) || []
            array[ Number(index) ] = value
            set(attributes, arrayName, array)
            return attributes
          } else {
            return Object.assign(attributes, { [name]: value })
          }
        }, { id: s.cid })
        return expand(values)
      }
    },
    classMethods: {
      forList (resource, { offset, limit, filter, sort } = {}) {
        const { id: ResourceId } = resource
        filter = parseFilter(filter)
        sort = normalizeSort(sort)
        const { QueryGenerator } = db.dialect

        const whereTerm = buildWhereTerm({ QueryGenerator, filter })
        const orderTerm = buildOrderTerm({ sort })
        const selectSQL = buildSelectSQL({ filter, sort, limit, offset, orderTerm, whereTerm })
        const countSQL = buildCountSQL({ filter, whereTerm })

        return co(function * () {
          const ids = (yield db.query(selectSQL, {
            type: db.QueryTypes.SELECT,
            raw: true,
            replacements: {
              ResourceId
            }
          })).map(({ id }) => id)
          const rows = []
          {
            const entities = yield Entity.findAll({
              where: { id: ids },
              include: [
                {
                  model: EntityAttribute
                }
              ]
            })
            for (let entity of entities) {
              const index = ids.indexOf(entity.id)
              rows[ index ] = entity
            }
          }
          const { count } = (yield db.query(countSQL, {
            type: db.QueryTypes.SELECT,
            replacements: {
              ResourceId
            }
          }))[ 0 ]
          return { rows, count }
        })
      },
      forOne (resource, cid) {
        const { id: ResourceId } = resource
        return co(function * () {
          const cacheKey = Entity.cacheKeyFor(resource, cid)
          const cached = Entity.forOneCache.get(cacheKey)
          if (cached) {
            return cached
          }
          const found = yield Entity.findOne({
            where: { ResourceId, cid },
            include: [
              { model: EntityAttribute }
            ]
          })
          Entity.forOneCache.set(cacheKey, found)
          return found
        })
      },
      cacheKeyFor (resource, cid) {
        return [ resource.id, cid ].join('/')
      }
    }
  })

  Entity.forOneCache = LRU({
    max: 500,
    maxAge: 1000 * 60 * 60
  })

  const EntityAttribute = define('EntityAttribute', {
    name: {
      comment: 'Name of attribute',
      type: STRING,
      allowNull: false
    },
    type: {
      comment: 'Type of attribute',
      type: STRING,
      defaultValue: 'string',
      allowNull: false
    },
    value: {
      comment: 'Value of attribute',
      type: STRING,
      allowNull: true
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: [ 'EntityId', 'name' ]
      }
    ],
    instanceMethods: {
      toValue () {
        const s = this
        const { value, type } = s
        return deserialize(value, type)
      }
    },
    classMethods: {
      setAttributeValues (entity, values) {
        const { id: EntityId } = entity
        return co(function * () {
          const tasks = []
          const attributeValues = Object.keys(values).reduce((attributeValues, name) =>
            Object.assign(
              attributeValues,
              normalizeAttributeValues(name, values[ name ])
            ), {})
          const names = Object.keys(attributeValues)
          const knownEntityAttributes = yield EntityAttribute.findAll({
            attributes: [ 'id', 'name', 'type', 'value' ],
            where: {
              EntityId,
              name: { $in: names }
            }
          })
          const knownNames = knownEntityAttributes.map(({ name }) => name)
          const unknownNames = names.filter((name) => !knownNames.includes(name))
          tasks.push(
            EntityAttribute.bulkCreate(
              unknownNames.map((name) => {
                const value = attributeValues[ name ]
                const type = typeOf(value)
                return {
                  EntityId,
                  name,
                  type,
                  value: serialize(value, type)
                }
              })
            )
          )
          for (let instance of knownEntityAttributes) {
            const { name } = instance
            const type = typeOf(attributeValues[ name ])
            const value = serialize(attributeValues[ name ], type)
            const skip = (instance.value === value) && (instance.type === type)
            if (skip) {
              continue
            }
            tasks.push(
              instance.update({ type, value })
            )
          }
          yield Promise.all(tasks)
        })
      }
    }
  })

  Entity.belongsTo(Resource)
  EntityAttribute.belongsTo(Entity, { onDelete: 'CASCADE' })
  Entity.hasMany(EntityAttribute, { onDelete: 'CASCADE' })
  return {
    Resource,
    Entity,
    EntityAttribute
  }
}

module.exports = defineModels
