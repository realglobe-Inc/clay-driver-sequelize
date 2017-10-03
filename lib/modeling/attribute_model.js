/**
 * Define entity attribute model
 * @function attributeModel
 */
'use strict'

const {STRING, INTEGER} = require('sequelize')
const {typeOf} = require('clay-serial')
const asleep = require('asleep')
const {serialize} = require('../helpers/serializer')
const LRU = require('lru-cache')
const sqQueue = require('sg-queue')
const {ATTRIBUTE_SUFFIX} = require('../constants/model_keywords')

/** @lends attributeModel */
function attributeModel ({db, prefix = ''}) {
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
        const cache = Attribute.allCache.get('entities')
        if (cache) {
          return cache
        }
        const found = await Attribute.findAll()
        Attribute.allCache.set('entities', found)
        return found
      },

      async colsFor (values) {
        while (Attribute.colsForWorking) {
          await asleep(10)
        }
        Attribute.colsForWorking = true
        const names = Object.keys(values).filter((name) => name !== 'id')
        let entityAttributes
        try {
          const knownAttributes = await Attribute.findAll({
            attributes: ['name', 'col'],
            where: {name: {$in: names}}
          })
          entityAttributes = [...knownAttributes]

          const knownNames = knownAttributes.map(({name}) => name)
          const unknownNames = names.filter((name) => !knownNames.includes(name))
          if (unknownNames.length > 0) {
            await queue.push(async () => {
              const colBase = (await Attribute.findOne({
                order: [['col', 'DESC']]
              }))
              const colBaseCol = colBase ? colBase.col + 1 : 0
              const newAttributes = await Attribute.bulkCreate(
                unknownNames.map((name, i) => ({
                  name, col: colBaseCol + i
                }))
              )
              entityAttributes = entityAttributes.concat(newAttributes)
              Attribute.allCache.reset()
            })
          }
        } finally {
          Attribute.colsForWorking = false
        }
        return entityAttributes
          .map(({name, col}) => {
            const type = typeOf(values[name])
            const value = serialize(values[name], type)
            return {
              col,
              name,
              type,
              value
            }
          })
      }
    }
  })

  Attribute.allCache = LRU({
    max: 10,
    maxAge: 2 * 1000
  })

  return Attribute
}

module.exports = attributeModel
