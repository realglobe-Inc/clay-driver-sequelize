/**
 * Define sequelize models
 * @function defineModels
 * @param {Sequelize} db - A sequelize instance
 * @returns {Object} Defined models
 */
'use strict'

const Sequelize = require('sequelize')
const co = require('co')
const { BOOLEAN, STRING, DATE } = Sequelize

/** @lends defineModels */
function defineModels (db) {
  let define = (name, attributes, options = {}) => db.define(name, attributes, Object.assign({}, options))

  const Resource = define('Resource', {
    namespace: {
      comment: 'Name space string',
      type: STRING,
      allowNull: false,
      unique: true
    }
  }, {
    indexes: [],
    classMethods: {
      ofNamespace (namespace) {
        return co(function * () {
          let [ resource ] = yield Resource.findOrCreate({
            where: { namespace },
            defaults: { namespace }
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
        fields: [ 'cid' ],
        name: 'cid'
      },
      {
        unique: true,
        fields: [ 'resourceId', 'cid' ],
        name: 'cid_uniqueness'
      }
    ]
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
        fields: [ 'entityId', 'name' ],
        name: 'name_uniqueness'
      }
    ],
    classMethods: {
      setAttributeValues (entity, values) {
        let { id: EntityId } = entity
        return co(function * () {
          for (let name of Object.keys(values)) {
            let value = values[ name ]
            let [ entityAttribute ] = yield EntityAttribute.findOrCreate({
              where: { EntityId, name }
            })
            yield entityAttribute.update({
              type: typeof value,
              value: value
            })
          }
        })
      }
    }
  })

  Entity.belongsTo(Resource)
  EntityAttribute.belongsTo(Entity)
  Entity.hasMany(EntityAttribute, { as: 'attributes' })
  return {
    Resource,
    Entity,
    EntityAttribute
  }

}

module.exports = defineModels
