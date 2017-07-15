/**
 * Define entity model
 * @function entityModel
 * @param {function} define - Definer
 * @returns {Object} Defined model
 */
'use strict'

const { STRING } = require('sequelize')
const { parseFilter, parseSort } = require('../helpers/parser')
const { get, set } = require('../helpers/attribute_access')
const { expand } = require('objnest')
const LRU = require('lru-cache')
const { deserialize } = require('../helpers/serializer')
const ARRAY_LAST_INDEX_PATTERN = /(.*)(\[)([0-9]+)(\])$/
const { ENTITY_SUFFIX } = require('../constants/model_keywords')

const { DataTypes } = require('clay-constants')

const DataTypesArray = Object.keys(DataTypes).map((name) => DataTypes[ name ])

const attributesWith = (entityAttributes) =>
  [
    ...entityAttributes.reduce((attributes, { col }) => [ ...attributes, `t${col}`, `v${col}` ], []),
    'id',
    'cid',
    'createdAt',
    'updatedAt'
  ]

/** @lends entityModel */
function entityModel ({
                        db,
                        resourceName,
                        prefix = '',
                        cols = 50
                      }) {
  const modelName = prefix + ENTITY_SUFFIX
  const Entity = db.define(modelName, Object.assign(
    {
      cid: {
        comment: 'Clay id',
        type: STRING,
        allowNull: false,
        unique: true
      }
    },
    ...new Array(cols).fill(null)
      .map((_, col) => ({
        [`t${col}`]: {
          comment: `Type for ${col}`,
          type: STRING(3),
          allowNull: true
        },
        [`v${col}`]: {
          comment: `Value for ${col}`,
          type: STRING,
          allowNull: true
        }
      }))
  ), {
    freezeTableName: true,
    instanceMethods: {
      valueFor (col) {
        const s = this
        const type = DataTypesArray[ s[ `t${col}` ] ]
        const value = s[ `v${col}` ]
        if (!type) {
          return value
        }
        return deserialize(value, type)
      },
      asClay (entityAttributes) {
        const s = this
        const values = entityAttributes.reduce((attributes, entityAttribute) => {
          const { name, col } = entityAttribute
          const isArray = ARRAY_LAST_INDEX_PATTERN.test(name)
          const value = s.valueFor(col)
          if (isArray) {
            let [ , arrayName, , index ] = name.match(ARRAY_LAST_INDEX_PATTERN)
            let array = get(attributes, arrayName) || []
            array[ Number(index) ] = value
            set(attributes, arrayName, array)
            return attributes
          } else {
            return Object.assign(attributes, { [name]: value })
          }
        }, {
          id: s.cid,
          $$at: s.updatedAt,
          $$as: resourceName
        })
        return expand(values)
      }
    },
    classMethods: {
      attributesWithCols (cols) {
        return Object.assign(
          {},
          ...cols.map(({ col, type, value }) => ({
            [`t${col}`]: DataTypesArray.indexOf(type),
            [`v${col}`]: value
          }))
        )
      },
      async forList (entityAttributes, { offset, limit, filter, sort } = {}) {
        const s = this

        return s.findAndCountAll({
          attributes: [ ...attributesWith(entityAttributes) ],
          where: parseFilter(filter, { entityAttributes }),
          order: parseSort(sort, { entityAttributes }),
          limit,
          offset
        })
      },
      async forOne (entityAttributes, cid) {
        const cacheKey = Entity.cacheKeyFor(cid)
        const cached = Entity.forOneCache.get(cid)
        if (cached) {
          return cached
        }
        const found = await Entity.findOne({
          attributes: [ ...attributesWith(entityAttributes) ],
          where: { cid }
        })
        Entity.forOneCache.set(cacheKey, found)
        return found
      },
      cacheKeyFor (cid) {
        return cid
      }
    }
  })

  Entity.forOneCache = LRU({
    max: 500,
    maxAge: 1000 * 60 * 60
  })

  return Entity
}

module.exports = entityModel
