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
const { OBJECT, REF, NUMBER } = DataTypes
const { expand } = require('objnest')

const as = (prefix, name) => [ prefix, name ].join('X')
  .replace(/\$/g, '_')
  .replace(/\./g, '_')
const sortAs = (name) => as('sorting', name)
const filterAs = (name) => as('filtering', name)
const sortAbs = (name) => name.replace(/^-/, '')
const padLeft = (value, digit, padding = '0') => new Array(digit - String(value).length + 1).join(padding || '0') + value

const parseFilter = (filter) => {
  if (!filter) {
    return filter
  }
  let parsed = {}
  for (let name of Object.keys(filter)) {
    let value = filter[ name ]
    let type = typeOf(value)
    switch (type) {
      case REF: {
        parsed[ `${name}.$ref` ] = value.$ref
        break
      }
      case OBJECT: {
        let subNames = Object.keys(value)
        for (let subName of subNames) {
          let subValue = value[ subName ]
          let isOperator = /^\$/.test(subName)
          if (isOperator) {
            parsed[ name ] = parsed[ name ] || {}
            parsed[ name ][ subName ] = serialize(subValue)
          } else {
            parsed[ `${name}.${subName}` ] = serialize(subValue)
          }
        }
        break
      }
      default: {
        parsed[ name ] = serialize(value)
        break
      }
    }
  }
  return parsed
}

const serialize = (value, type = typeOf(value)) => {
  switch (type) {
    case NUMBER: {
      const MAX_NUMBER_DIGIT = 24
      if (String(value).length > MAX_NUMBER_DIGIT) {
        throw new Error(`[ClayDriverSequelize] Too large number: ${value}`)
      }
      // TODO $gt/$ltのためにゼロ詰めした文字列にしているけど非効率なので他の手段を考える
      return padLeft(value, MAX_NUMBER_DIGIT)
    }
    default: {
      return String(value)
    }
  }
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
              [`$${filterAs(name)}.value$`]: filter[ name ]
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
            value: serialize(value, type)
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
