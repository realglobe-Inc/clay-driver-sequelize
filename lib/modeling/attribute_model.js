/**
 * Define entity attribute model
 * @function attributeModel
 */
'use strict'

const { STRING, INTEGER } = require('sequelize')
const { typeOf } = require('clay-serial')
const { serialize } = require('../helpers/serializer')
const LRU = require('lru-cache')
const sqQueue = require('sg-queue')
const { ATTRIBUTE_SUFFIX } = require('../constants/model_keywords')

/** @lends attributeModel */
function attributeModel ({ db, prefix = '' }) {
  const modelName = prefix + ATTRIBUTE_SUFFIX
  const queue = sqQueue()
  const Attribute = db.define(modelName, {
    col: {
      comment: 'Col number',
      type: INTEGER,
      allowNull: false,
      unique: true
    },
    name: {
      comment: 'Name of attribute',
      type: STRING,
      allowNull: false,
      unique: true
    }
  }, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    instanceMethods: {},
    classMethods: {
      async allOf () {
        const ENTITIES_KEY = 'entities'

        const cached = Attribute.allCache.get(ENTITIES_KEY)
        if (cached) {
          return cached
        }

        if (Attribute.allCacheWorking) {
          await Promise.resolve(Attribute.allCacheWorking)
          return Attribute.allOf()
        }

        return Attribute.allCacheWorking = (async () => {
          const found = await Attribute.findAll()
          Attribute.allCache.set(ENTITIES_KEY, found)
          Attribute.allCacheWorking = null
          return found
        })()
      },

      async colsFor (values, { Lock } = {}) {
        if (Attribute.colsForWorking) {
          await Promise.resolve(Attribute.colsForWorking)
        }
        return Attribute.colsForWorking = (async () => {
          const names = Object.keys(values).filter((name) => name !== 'id')
          let entityAttributes
          try {
            const knownAttributes = (await Attribute.allOf())
              .filter(({ name }) => names.includes(name))
              .map(({ name, col }) => ({ name, col }))
            entityAttributes = [...knownAttributes]

            const knownNames = knownAttributes.map(({ name }) => name)
            const unknownNames = names.filter((name) => !knownNames.includes(name))
            if (unknownNames.length > 0) {
              const lockName = `${modelName}/attributes`
              await queue.push(async () => {
                const colBase = (await Attribute.findOne({
                  order: [['col', 'DESC']]
                }))
                await Lock.waitToLock(lockName)
                await Lock.lockWhile(lockName, async () => {
                  Attribute.allCache.reset()
                  const knownNames = (await Attribute.allOf())
                    .filter(({ name }) => names.includes(name))
                    .map(({ name }) => name) // Fetch known names again because it might be changed
                  const colBaseCol = colBase ? colBase.col + 1 : 0
                  const newAttributes = await Attribute.bulkCreate(
                    unknownNames
                      .filter((name) => !knownNames.includes(name))
                      .map((name, i) => ({
                        name, col: colBaseCol + i
                      }))
                  )
                  entityAttributes = entityAttributes.concat(newAttributes)
                  Attribute.allCache.reset()
                })
              })
            }
          } finally {
            Attribute.colsForWorking = null
          }
          return entityAttributes
            .map(({ name, col }) => {
              const type = typeOf(values[name])
              const value = serialize(values[name], type, {})
              return {
                col,
                name,
                type,
                value
              }
            })
        })()
      }
    }
  })

  Attribute.allCache = new LRU({
    max: 10,
    maxAge: 2 * 1000
  })
  Attribute.allCacheWorking = null

  return Attribute
}

module.exports = attributeModel
