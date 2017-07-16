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

const attributeValuessWith = (attributes) =>
  [
    ...attributes.reduce((attributes, { col }) => [ ...attributes, `t${col}`, `v${col}` ], []),
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
                        numberOfCols = 64
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
    ...new Array(numberOfCols).fill(null)
      .map((_, col) => ({
        [`t${col}`]: {
          comment: `Type for ${col}`,
          type: STRING(2),
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
      asClay (attributes) {
        const s = this
        const values = attributes.reduce((attributeValues, attribute) => {
          const { name, col } = attribute
          const isArray = ARRAY_LAST_INDEX_PATTERN.test(name)
          const value = s.valueFor(col)
          if (isArray) {
            let [ , arrayName, , index ] = name.match(ARRAY_LAST_INDEX_PATTERN)
            let array = get(attributeValues, arrayName) || []
            array[ Number(index) ] = value
            set(attributeValues, arrayName, array)
            return attributeValues
          } else {
            return Object.assign(attributeValues, { [name]: value })
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
      valuesWithCols (cols) {
        if (cols.length > numberOfCols) {
          throw new Error(`[ClayDriverSequelize] Too many cols for resource: "${resourceName}"`)
        }
        return Object.assign(
          {},
          ...cols.map(({ col, type, value }) => ({
            [`t${col}`]: DataTypesArray.indexOf(type),
            [`v${col}`]: value
          }))
        )
      },
      async forList (attributes, { offset, limit, filter, sort } = {}) {
        const s = this

        return s.findAndCountAll({
          attributes: [ ...attributeValuessWith(attributes) ],
          where: parseFilter(filter, { attributes }),
          order: parseSort(sort, { attributes }),
          limit,
          offset
        })
      },
      async forOne (attributes, cid) {
        const cacheKey = Entity.cacheKeyFor(cid)
        const cached = Entity.forOneCache.get(cid)
        if (cached) {
          return cached
        }
        const found = await Entity.findOne({
          attributes: [ ...attributeValuessWith(attributes) ],
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
