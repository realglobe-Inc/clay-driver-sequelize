/**
 * Define entity attribute model
 * @function entityAttributeModel
 */
'use strict'

const { normalizeAttributeValues } = require('../helpers/normalizer')
const { STRING, INTEGER } = require('sequelize')
const { typeOf } = require('clay-serial')
const asleep = require('asleep')
const { serialize } = require('../helpers/serializer')
const { ENTITY_ATTRIBUTE_SUFFIX } = require('../constants/model_keywords')

/** @lends entityAttributeModel */
function entityAttributeModel ({ db, prefix = '' }) {
  const modelName = prefix + ENTITY_ATTRIBUTE_SUFFIX
  const EntityAttribute = db.define(modelName, {
    col: {
      comment: 'Col number',
      type: INTEGER,
      allowNull: false
    },
    name: {
      comment: 'Name of attribute',
      type: STRING,
      allowNull: false
    }
  }, {
    freezeTableName: true,
    createdAt: false,
    updatedAt: false,
    instanceMethods: {},
    classMethods: {
      async allOf () {
        if (EntityAttribute.allCache) {
          return EntityAttribute.allCache
        }
        const found = await EntityAttribute.findAll()
        EntityAttribute.allCache = found

        return found
      },

      async colsFor (values) {
        while (EntityAttribute.colsForWorking) {
          await asleep(10)
        }
        EntityAttribute.colsForWorking = true
        const attributeValues = Object.keys(values)
          .filter((name) => !/^\$\$/.test(name))
          .filter((name) => name !== 'id')
          .reduce((attributeValues, name) =>
            Object.assign(
              attributeValues,
              normalizeAttributeValues(name, values[ name ])
            ), {})
        const names = Object.keys(attributeValues)
        let entityAttributes
        try {
          const knownEntityAttributes = await EntityAttribute.findAll({
            attributes: [ 'name', 'col' ],
            where: { name: { $in: names } }
          })
          entityAttributes = [ ...knownEntityAttributes ]

          const knownNames = knownEntityAttributes.map(({ name }) => name)
          const unknownNames = names.filter((name) => !knownNames.includes(name))
          if (unknownNames.length > 0) {
            const colBase = (await EntityAttribute.findOne({
              order: [ [ 'col', 'DESC' ] ]
            }))
            const colBaseCol = colBase ? colBase.col + 1 : 0
            const newEntityAttributes = await EntityAttribute.bulkCreate(
              unknownNames.map((name, i) => ({
                name, col: colBaseCol + i
              }))
            )
            entityAttributes = entityAttributes.concat(newEntityAttributes)
            delete EntityAttribute.allCache
          }
          EntityAttribute.colsForWorking = false

        } finally {
          EntityAttribute.colsForWorking = false
        }
        return entityAttributes.map(({ name, col }) => {
          const type = typeOf(attributeValues[ name ])
          const value = serialize(attributeValues[ name ], type)
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
  return EntityAttribute
}

module.exports = entityAttributeModel
