/**
 * Define sequelize models
 * @function defineModels
 * @param {Sequelize} db - A sequelize instance
 * @returns {Object} Defined models
 */
'use strict'

const Sequelize = require('sequelize')
const co = require('co')
const { STRING } = Sequelize
const { DataTypes } = require('clay-constants')
const { typeOf, withType } = require('clay-serial')
const { OBJECT, REF } = DataTypes
const { expand } = require('objnest')

const parseValue = (value) => String(value)

const as = (prefix, name) => [ prefix, name ].join('X')
  .replace(/\$/g, '_')
  .replace(/\./g, '_')
const sortAs = (name) => as('sorting', name)
const filterAs = (name) => as('filtering', name)
const sortAbs = (name) => name.replace(/^-/, '')

const parseFilter = (filter) => {
  if (!filter) {
    return filter
  }
  let parsed = {}
  for (let key of Object.keys(filter)) {
    let value = filter[ key ]
    let type = typeOf(value)
    switch (type) {
      case REF: {
        parsed[ `${key}.$ref` ] = value.$ref
        break
      }
      default: {
        parsed[ key ] = filter[ key ]
        break
      }
    }
  }
  return parsed
}

/** @lends defineModels */
function defineModels (db) {
  let define = (name, attributes, options = {}) => db.define(name, attributes, Object.assign({}, options))
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
          let cached = Resource.getCacheForName(name)
          if (cached) {
            return cached
          }
          let [ resource ] = yield Resource.findOrCreate({
            where: { name },
            defaults: { name }
          })
          Resource.setCacheForName(name, resource)
          return resource
        })
      }
    }
  })
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
        let values = s.EntityAttributes.reduce((attributes, entityAttribute) => Object.assign(attributes, {
          [entityAttribute.name]: entityAttribute.toValue()
        }), { id: s.cid })
        return expand(values)
      }
    },
    classMethods: {
      forList (resource, { offset, limit, filter, sort } = {}) {
        const { id: ResourceId } = resource
        filter = parseFilter(filter)
        const normalizeSort = (sort) => [].concat(sort)
          .filter(Boolean)
          .reduce((names, name) => names.concat(name.split(',')), [])
          .filter(Boolean)
        return co(function * () {
          let filterKeys = Object.keys(filter || {})
          let { rows, count } = yield Entity.findAndCountAll({
            distinct: 'cid',
            where: Object.assign({
              ResourceId
            }, ...filterKeys.map((name) => ({
              [`$${filterAs(name)}.value$`]: parseValue(filter[ name ])
            }))),
            include: [
              {
                model: EntityAttribute
              },
              ...filterKeys.map((name) => ({
                required: true,
                where: { name },
                association: Entity.hasOne(EntityAttribute, {
                  as: filterAs(name)
                })
              })),
              ...normalizeSort(sort).map((name) => ({
                required: false,
                where: { name: sortAbs(name) },
                association: Entity.hasOne(EntityAttribute, {
                  as: sortAs(sortAbs(name))
                })
              }))
            ],
            order: normalizeSort(sort)
              .map((name) => ([
                { model: EntityAttribute, as: sortAs(sortAbs(name)) },
                'value',
                /^-/.test(name) ? 'DESC' : 'ASC'
              ])).concat('createdAt'),
            offset,
            limit
          })

          return { rows, count }
        })
      },
      forOne (resource, cid) {
        const { id: ResourceId } = resource
        return co(function * () {
          return yield Entity.findOne({
            where: { ResourceId, cid },
            include: [
              { model: EntityAttribute }
            ]
          })
        })
      }
    }
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
        let { value, type } = s
        // TODO Json support
        return withType(value, type)
      }
    },
    classMethods: {
      setAttributeValues (entity, values) {
        // TODO make it parallel for better performance
        return co(function * () {
          for (let name of Object.keys(values)) {
            let value = values[ name ]
            yield EntityAttribute.setAttributeValue(entity, name, value)
          }
        })
      },
      setAttributeValue (entity, name, value) {
        const { id: EntityId } = entity
        return co(function * () {
          let type = typeOf(value)
          // TODO Array support
          switch (type) {
            case REF:
            case OBJECT: {
              let subValues = Object.keys(value)
                .reduce((subValues, subKey) => Object.assign(subValues, {
                  [`${name}.${subKey}`]: value[ subKey ]
                }), {})
              return yield EntityAttribute.setAttributeValues(entity, subValues)
            }
            default: {
              break
            }
          }
          let [ entityAttribute ] = yield EntityAttribute.findOrCreate({
            where: { EntityId, name },
            defaults: { EntityId, name }
          })
          yield entityAttribute.update({
            type,
            value: parseValue(value)
          })
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
