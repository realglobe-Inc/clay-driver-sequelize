/**
 * Abstract driver
 * @augments Driver
 * @class SequelizeDriver
 * @see https://github.com/sequelize/sequelize#readme
 */
'use strict'

const { Driver } = require('clay-driver-base')
const co = require('co')
const { defineModels } = require('./modeling')
const clayId = require('clay-id')
const clayEntity = require('clay-entity')
const clayCollection = require('clay-collection')
const { pageToOffsetLimit } = require('clay-list-pager')
const Sequelize = require('sequelize')
const { LogPrefixes } = require('clay-constants')

const { DRIVER_PREFIX } = LogPrefixes

/** @lends SequelizeDriver */
class SequelizeDriver extends Driver {

  constructor (database, username, password, options) {
    super()
    const s = this

    let db = new Sequelize(database, username, password, options)
    s._db = db
    s._synced = false
    s._models = defineModels(db)
  }

  getModels () {
    const s = this
    return co(function * () {
      if (!s._synced) {
        yield s._db.sync()
        s._synced = true
      }
      return s._models
    })
  }

  /** @inheritDoc */
  one (namespace, id) {
    const s = this
    return co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofNamespace(namespace)
      let entity = yield Entity.findOne({
        where: {
          ResourceId: resource.id,
          cid: String(id)
        },
        include: [
          { model: EntityAttribute, as: 'attributes' }
        ]
      })
      if (!entity) {
        return null
      }
      return clayEntity(Object.assign(entity.toValue(), {
        id: clayId(entity.cid)
      }))
    })
  }

  /** @inheritDoc */
  list (namespace, condition = {}) {
    const s = this
    return co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofNamespace(namespace)
      let { filter, page } = condition
      let { limit, offset } = pageToOffsetLimit(page)
      let { rows, count } = yield Entity.findAndCountAll({
        where: {
          ResourceId: resource.id
        },
        include: [
          {
            model: EntityAttribute,
            as: 'attributes',
            required: true,
            where: {
              // TODO Filtering
            }
          }
        ],
        offset,
        limit
      })
      return clayCollection({
        entities: rows.map((entity) => clayEntity(entity.toValue())),
        meta: {
          offset,
          limit,
          total: count,
          length: rows.length
        }
      })
      // TODO
    })
  }

  /** @inheritDoc */
  create (namespace, attributes) {
    const s = this
    return co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofNamespace(namespace)
      let id = clayId()
      let entity = yield Entity.create({
        cid: String(id),
        ResourceId: resource.id
      })
      yield EntityAttribute.setAttributeValues(entity, attributes)
      return yield s.one(namespace, id)
    })
  }

  /** @inheritDoc */
  update (namespace, id, attributes) {
    const s = this
    return co(function * () {
      const { EntityAttribute } = yield s.getModels()
      let entity = yield s.one(namespace, id)
      yield EntityAttribute.setAttributeValues(entity, attributes)
      return yield s.one(namespace, id)
    })
  }

  /** @inheritDoc */
  destroy (namespace, id) {
    const s = this
    return co(function * () {
      let entity = yield s.one(namespace, id)
      if (!entity) {
        return 0
      }
      yield entity.destroy()
      return 1
    })
  }

}

module.exports = SequelizeDriver
