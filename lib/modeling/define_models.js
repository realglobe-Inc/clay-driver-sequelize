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
const { EOL } = require('os')
const { STRING } = Sequelize
const { DataTypes } = require('clay-constants')
const { typeOf, withType } = require('clay-serial')
const { OBJECT, REF, NUMBER, DATE } = DataTypes
const { expand } = require('objnest')
const { get, set } = require('../helpers/attribute_access')

const as = (prefix, name) => [ prefix, name ].join('X')
  .replace(/\$/g, '_')
  .replace(/\./g, '_')
const sortAs = (name) => as('sorting', name)
const filterAs = (name) => as('filtering', name)
const sortAbs = (name) => name.replace(/^-/, '')
const padLeft = (value, digit, padding = '0') => new Array(digit - String(value).length + 1).join(padding || '0') + value

const ARRAY_LAST_INDEX_PATTERN = /(.*)(\[)([0-9]+)(\])$/

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
            parsed[ name ][ subName ] = Array.isArray(subValue) ? subValue.map((v) => serialize(v)) : serialize(subValue)
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
    case DATE: {
      return String(new Date(value).getTime())
    }
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

const deserialize = (value, type) => {
  switch (type) {
    case DATE: {
      value = Number(value)
      break
    }
    default: {
      break
    }
  }
  return withType(value, type)
}

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
            yield asleep(10)
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
          let { name } = entityAttribute
          let isArray = ARRAY_LAST_INDEX_PATTERN.test(name)
          let value = entityAttribute.toValue()
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
        const normalizeSort = (sort) => [].concat(sort)
          .filter(Boolean)
          .reduce((names, name) => names.concat(name.split(',')), [])
          .filter(Boolean)
        return co(function * () {
          let filterKeys = Object.keys(filter || {})

          let whereTerm = filterKeys.map((name) => {
            return db.dialect.QueryGenerator.whereItemQuery('value', filter[ name ], { prefix: filterAs(name) })
          }).filter(Boolean).map((v) => v.trim()).join(' AND ')

          let orderTerm = normalizeSort(sort).map((name) => {
            return `\`${sortAs(sortAbs(name))}\`.value ${/^-/.test(name) ? 'DESC' : 'ASC'}`
          }).filter(Boolean).join(', ')

          let selectSQL = `
SELECT
  \`Entity\`.id as id 
FROM \`Entities\` AS \`Entity\`
${filterKeys.map((name) => `
INNER JOIN \`EntityAttributes\` AS \`${filterAs(name)}\`
  ON \`Entity\`.\`id\` = \`${filterAs(name)}\`.\`EntityId\` AND \`${filterAs(name)}\`.\`name\` = '${name}'
`).join(' ')}
${normalizeSort(sort).map((name) => `
LEFT OUTER JOIN \`EntityAttributes\` AS \`${sortAs(sortAbs(name))}\`
  ON \`Entity\`.\`id\` = \`${sortAs(sortAbs(name))}\`.\`EntityId\` AND \`${sortAs(sortAbs(name))}\`.\`name\` = '${sortAbs(name)}'
`).join(' ')}
WHERE \`Entity\`.\`ResourceId\` = ${ResourceId} 
${whereTerm ? `AND ${whereTerm.trim()}` : ''}    
${orderTerm ? `ORDER BY ${orderTerm.trim()}` : `ORDER BY \`Entity\`.createdAt`}
${limit ? `LIMIT ${limit}` : ''}
${offset ? `OFFSET ${offset}` : ''}
          `.split(EOL).join(' ').trim()
          let ids = (yield db.query(selectSQL, {
            type: db.QueryTypes.SELECT,
            raw: true
          })).map(({ id }) => id)
          let rows = []
          {
            let entities = yield Entity.findAll({
              where: { id: ids },
              include: [
                {
                  model: EntityAttribute
                }
              ]
            })
            for (let entity of entities) {
              let index = ids.indexOf(entity.id)
              rows[ index ] = entity
            }
          }
          let countSQL = `
SELECT 
  count(DISTINCT(\`Entity\`.\`id\`)) AS \`count\`
FROM \`Entities\` AS \`Entity\`
${filterKeys.map((name) => `
    INNER JOIN \`EntityAttributes\` AS \`${filterAs(name)}\`
      ON \`Entity\`.\`id\` = \`${filterAs(name)}\`.\`EntityId\` AND \`${filterAs(name)}\`.\`name\` = '${name}'
    `).join(' ')}
WHERE \`Entity\`.\`ResourceId\` = ${ResourceId}
${whereTerm ? `AND ${whereTerm}` : ''}    
          `.split(EOL).join(' ').trim()
          let { count } = (yield db.query(countSQL, {
            type: db.QueryTypes.SELECT
          }))[ 0 ]
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
        return deserialize(value, type)
      }
    },
    classMethods: {
      setAttributeValues (entity, values) {
        return Promise.all(
          Object.keys(values).map((name) => {
            return co(function * () {
              let value = values[ name ]
              yield EntityAttribute.setAttributeValue(entity, name, value)
            })
          })
        )
      },
      setAttributeValue (entity, name, value) {
        const { id: EntityId } = entity
        return co(function * () {
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              yield EntityAttribute.setAttributeValue(entity, `${name}[${i}]`, value[ i ])
            }
            return
          }
          let type = typeOf(value)
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
          yield EntityAttribute.upsert({
            EntityId,
            name,
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

defineModels.Resource = () => {

}

module.exports = defineModels
