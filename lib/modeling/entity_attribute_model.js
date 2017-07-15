/**
 * @function entityAttributeModel
 */
'use strict'

const { normalizeAttributeValues } = require('../helpers/normalizer')
const co = require('co')
const { STRING } = require('sequelize')
const { typeOf } = require('clay-serial')
const { serialize, deserialize } = require('../helpers/serializer')
const { ENTITY_SUFFIX, ID_SUFFIX, ENTITY_ATTRIBUTE_SUFFIX } = require('../constants/model_keywords')

/** @lends entityAttributeModel */
function entityAttributeModel ({ db, prefix = '' }) {
  const modelName = prefix + ENTITY_ATTRIBUTE_SUFFIX
  const entityModelIdName = prefix + ENTITY_SUFFIX + ID_SUFFIX
  const EntityAttribute = db.define(modelName, {
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
    freezeTableName: true,
    createdAt: false,
    indexes: [
      {
        unique: true,
        fields: [ entityModelIdName, 'name' ]
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
          const attributeValues = Object.keys(values)
            .filter((name) => !/^\$\$/.test(name))
            .reduce((attributeValues, name) =>
              Object.assign(
                attributeValues,
                normalizeAttributeValues(name, values[ name ])
              ), {})
          const names = Object.keys(attributeValues)
          const knownEntityAttributes = yield EntityAttribute.findAll({
            attributes: [ 'id', 'name', 'type', 'value' ],
            where: {
              [entityModelIdName]: EntityId,
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
                  [entityModelIdName]: EntityId,
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
  return EntityAttribute
}

module.exports = entityAttributeModel
