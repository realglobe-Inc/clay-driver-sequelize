/**
 * Define entity model
 * @function entityModel
 * @returns {Object} Defined model
 */
'use strict'

const {STRING, BLOB} = require('sequelize')
const {parseFilter, parseSort} = require('../helpers/parser')
const {get, set} = require('../helpers/attribute_access')
const {expand} = require('objnest')
const LRU = require('lru-cache')
const {deserialize} = require('../helpers/serializer')
const {pack, unpack} = require('msgpack')
const {ENTITY_SUFFIX, OVERFLOW_SUFFIX, ID_SUFFIX} = require('../constants/model_keywords')
const {clone} = require('asobj')

const {DataTypes} = require('clay-constants')

const DataTypesArray = Object.keys(DataTypes).map((name) => DataTypes[name])

const attributeValuesWith = (attributes) =>
  [
    ...attributes.reduce((attributes, {col}) => [...attributes, `t${col}`, `v${col}`], []),
    'id',
    'cid',
    'createdAt',
    'updatedAt'
  ]

const largerKeys = (data, count = 3) => {
  return Object.keys(data || {})
    .sort((a, b) => data[b] - data[a])
    .slice(0, count)
}

/** @lends entityModel */
function entityModel ({
                        db,
                        resourceName,
                        valueBaseLength = 255,
                        prefix = '',
                        numberOfCols = 64,
                        usageCounts = {}
                      }) {
  const modelName = prefix + ENTITY_SUFFIX
  const modelIdName = modelName + ID_SUFFIX
  const extraRefName = 'Extras'

  const keysToIndex = [
    ...largerKeys(usageCounts.whereCols),
    ...largerKeys(usageCounts.orderCols)
  ].filter((v, i, a) => a.indexOf(v) === i)

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
          type: STRING(valueBaseLength),
          allowNull: true
        }
      }))
  ), {
    freezeTableName: true,
    indexes: [
      ...keysToIndex.map((key) => ({
        fields: [key]
      }))
    ],
    instanceMethods: {
      valueFor (col, {extras} = {}) {
        const valueName = `v${col}`
        const typeName = `t${col}`
        const type = DataTypesArray[this[typeName]]
        const extra = extras[valueName]
        const value = extra ? extra : this[valueName]
        if (!type) {
          return value
        }
        try {
          return deserialize(value, type, {})
        } catch (e) {
          console.warn(`Data collapsed for id "${this.cid}" \n\t${e.message}`)
        }
      },
      asClay (attributes) {
        const extras = Object.assign(
          {},
          ...(this[extraRefName] || [])
            .filter(({value}) => !!value)
            .map(({name, value}) => ({
              [name]: unpack(value)
            }))
        )
        const values = attributes.reduce((attributeValues, attribute) => {
          const {name, col} = attribute
          const value = this.valueFor(col, {extras})
          return Object.assign(attributeValues, {[name]: value})
        }, {})
        Object.assign(values, {
          id: this.cid,
          $$num: this.id,
          $$at: this.updatedAt,
          $$as: resourceName
        })
        return expand(values)
      },
      async createExtra (extraValues) {
        const extraNames = Object.keys(extraValues)
          .filter((name) => !!extraValues[name])
        if (extraNames.length === 0) {
          return
        }
        await Entity.Extra.bulkCreate(
          extraNames.map((name) => ({
            name,
            value: pack(extraValues[name]),
            [modelIdName]: this.id
          }))
        )
      },
      async updateExtra (extraValues) {
        const extraNames = Object.keys(extraValues)
        if (extraNames.length === 0) {
          return
        }
        for (const name of extraNames) {
          await Entity.Extra.upsert({
            name,
            value: pack(extraValues[name]),
            [modelIdName]: this.id
          })
        }
      }
    },
    classMethods: {
      valuesWithCols (cols) {
        if (cols.length > numberOfCols) {
          throw new Error(`[ClayDriverSequelize] Too many cols for resource: "${resourceName}"`)
        }
        const extra = {}
        const base = Object.assign(
          {},
          ...cols.map(({col, type, value}) => {
            const typeKey = `t${col}`
            const valueKey = `v${col}`
            if (value && value.length >= valueBaseLength) {
              extra[valueKey] = value
              value = value.slice(0, valueBaseLength)
            } else {
              extra[valueKey] = null
            }
            return {
              [typeKey]: DataTypesArray.indexOf(type),
              [valueKey]: value
            }
          })
        )
        return {base, extra}
      },
      filterExtra (prevExtra, extra) {
        const filteredExtra = clone(extra)
        for (const key of Object.keys(extra)) {
          const hasExtra = Boolean(extra[key])
          const hasPrevExtra = Boolean(prevExtra[key])
          const shouldIgnore = !hasExtra && !hasPrevExtra
          if (shouldIgnore) {
            delete filteredExtra[key]
          }
        }
        return filteredExtra
      },
      async forList (attributes, {offset, limit, filter, sort} = {}) {
        const where = parseFilter(filter, {attributes, valueBaseLength})
        const order = parseSort(sort, {attributes})
        const {rows, count} = await this.findAndCountAll({
          attributes: [...attributeValuesWith(attributes)],
          where,
          order: order,
          distinct: true,
          include: [
            {model: Entity.Extra, as: extraRefName}
          ],
          limit,
          offset
        })
        return {rows, count, where, order}
      },
      async forOne (attributes, cid) {
        const cacheKey = Entity.cacheKeyFor(cid)
        const cached = Entity.forOneCache.get(cacheKey)
        if (cached) {
          return cached
        }
        const found = await Entity.findOne({
          attributes: [...attributeValuesWith(attributes)],
          include: [
            {model: Entity.Extra, as: extraRefName}
          ],
          where: {cid}
        })
        Entity.forOneCache.set(cacheKey, found)
        return found
      },
      cacheKeyFor (cid) {
        return String(cid)
      }
    }
  })

  Entity.forOneCache = LRU({
    max: 500,
    maxAge: 500
  })

  Entity.delCacheFor = (cid) => {
    Entity.forOneCache.del(Entity.cacheKeyFor(cid))
  }

  Entity.Extra = db.define(modelName + OVERFLOW_SUFFIX, {
    name: {
      comment: 'Name of attribute',
      type: STRING
    },
    value: {
      comment: 'Extra value',
      type: BLOB('long'),
      allowNull: true
    }
  }, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: [modelIdName, 'name']
      }
    ]
  })

  Entity.hasMany(Entity.Extra, {as: 'Extras', onDelete: 'cascade'})
  Entity.Extra.belongsTo(Entity)

  return Entity
}

module.exports = entityModel
