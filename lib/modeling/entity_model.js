/**
 * Define entity model
 * @function entityModel
 * @param {function} define - Definer
 * @returns {Object} Defined model
 */
'use strict'

const co = require('co')
const { STRING } = require('sequelize')
const { parseFilter } = require('../helpers/parser')
const { normalizeSort } = require('../helpers/normalizer')
const { buildWhereTerm, buildOrderTerm, buildSelectSQL, buildCountSQL } = require('../helpers/builder')
const { get, set } = require('../helpers/attribute_access')
const { expand } = require('objnest')
const LRU = require('lru-cache')
const ARRAY_LAST_INDEX_PATTERN = /(.*)(\[)([0-9]+)(\])$/
const { ENTITY_SUFFIX, ID_SUFFIX, ENTITY_ATTRIBUTE_SUFFIX } = require('../constants/model_keywords')

/** @lends entityModel */
function entityModel ({ db, Resource, EntityAttribute, prefix = '' }) {
  const modelName = prefix + ENTITY_SUFFIX
  const modelIdName = modelName + ID_SUFFIX
  const attributeModelRefName = prefix + ENTITY_ATTRIBUTE_SUFFIX
  const Entity = db.define(modelName, {
    cid: {
      comment: 'Clay id',
      type: STRING,
      allowNull: false
    }
  }, {
    freezeTableName: true,
    indexes: [
      {
        unique: true,
        fields: [ 'ResourceId', 'cid' ]
      }
    ],
    instanceMethods: {
      asClay () {
        const s = this
        const values = s[ attributeModelRefName ].reduce((attributes, entityAttribute) => {
          const { name } = entityAttribute
          const isArray = ARRAY_LAST_INDEX_PATTERN.test(name)
          const value = entityAttribute.toValue()
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
        sort = normalizeSort(sort)
        const { QueryGenerator } = db.dialect

        const whereTerm = buildWhereTerm({ QueryGenerator, filter })
        const orderTerm = buildOrderTerm({ sort })
        const selectSQL = buildSelectSQL({
          modelName,
          modelIdName,
          attributeModelRefName,
          filter,
          sort,
          limit,
          offset,
          orderTerm,
          whereTerm
        })

        const countSQL = buildCountSQL({
          modelName,
          modelIdName,
          attributeModelRefName,
          filter,
          whereTerm
        })

        return co(function * () {
          const ids = (yield db.query(selectSQL, {
            type: db.QueryTypes.SELECT,
            raw: true,
            replacements: {
              ResourceId
            }
          })).map(({ id }) => id)
          const rows = []
          {
            const entities = yield Entity.findAll({
              where: { id: ids },
              include: [
                {
                  model: EntityAttribute,
                  as: attributeModelRefName
                }
              ]
            })
            for (let entity of entities) {
              const index = ids.indexOf(entity.id)
              rows[ index ] = entity
            }
          }
          const { count } = (yield db.query(countSQL, {
            type: db.QueryTypes.SELECT,
            replacements: {
              ResourceId
            }
          }))[ 0 ]
          return { rows, count }
        })
      },
      forOne (resource, cid) {
        const { id: ResourceId } = resource
        return co(function * () {
          const cacheKey = Entity.cacheKeyFor(resource, cid)
          const cached = Entity.forOneCache.get(cacheKey)
          if (cached) {
            return cached
          }
          const found = yield Entity.findOne({
            where: { ResourceId, cid },
            include: [
              {
                model: EntityAttribute,
                as: attributeModelRefName
              }
            ]
          })
          Entity.forOneCache.set(cacheKey, found)
          return found
        })
      },
      cacheKeyFor (resource, cid) {
        return [ resource.id, cid ].join('/')
      }
    }
  })

  Entity.forOneCache = LRU({
    max: 500,
    maxAge: 1000 * 60 * 60
  })

  Entity.belongsTo(Resource)

  EntityAttribute.belongsTo(Entity, { onDelete: 'CASCADE' })
  Entity.hasMany(EntityAttribute, { onDelete: 'CASCADE', as: attributeModelRefName })

  return Entity
}

module.exports = entityModel
