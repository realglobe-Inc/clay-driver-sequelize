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
    indexes: [],
    classMethods: {
      ofName (name) {
        return co(function * () {
          let [ resource ] = yield Resource.findOrCreate({
            where: { name },
            defaults: { name }
          })
          return resource
        })
      }
    }
  })

  const Entity = define('Entity', {
    cid: {
      comment: 'Clay id',
      type: STRING,
      allowNull: false
    }
  }, {
    indexes: [
      {
        fields: [ 'cid' ]
      },
      {
        unique: true,
        fields: [ 'ResourceId', 'cid' ]
      }
    ],
    instanceMethods: {
      toValue () {
        const s = this
        return s.EntityAttributes.reduce((attributes, entityAttribute) => Object.assign(attributes, {
          [entityAttribute.name]: entityAttribute.toValue()
        }), {})
      }
    },
    classMethods: {
      forList (resource, { offset, limit, filter } = {}) {
        const { id: ResourceId } = resource
        return co(function * () {
          let filterKeys = Object.keys(filter || {})
          let { rows, count } = yield Entity.findAndCountAll({
            distinct: 'cid',
            where: Object.assign({
              ResourceId
            }, ...filterKeys.map((name) => ({
              [`$${name}.value$`]: filter[ name ]
            }))),
            include: [
              {
                model: EntityAttribute
              },
              ...filterKeys.map((name) => ({
                required: true,
                association: Entity.hasOne(EntityAttribute, {
                  where: { name },
                  as: name
                })
              }))
            ],
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
        // TODO clay-serialを使った型復元
        return value
      }
    },
    classMethods: {
      setAttributeValues (entity, values) {
        const { id: EntityId } = entity
        return co(function * () {
          for (let name of Object.keys(values)) {
            let value = values[ name ]
            let [ entityAttribute ] = yield EntityAttribute.findOrCreate({
              where: { EntityId, name },
              defaults: { EntityId, name }
            })
            // TODO clay-serialを使った型保存
            yield entityAttribute.update({
              type: 'string',
              value: String(value)
            })
          }
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
