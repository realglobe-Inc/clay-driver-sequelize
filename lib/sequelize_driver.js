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

  /** @inheritdoc */
  one (resourceName, id) {
    const s = this
    return co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let entity = yield Entity.forOne(resource, String(id))
      if (!entity) {
        return null
      }
      return clayEntity(Object.assign(entity.toValue(), {
        id: clayId(entity.cid)
      }))
    })
  }

  /** @inheritdoc */
  list (resourceName, condition = {}) {
    const s = this
    return co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let { filter, page } = condition
      let { limit, offset } = pageToOffsetLimit(page)
      let { rows, count } = yield Entity.forList(resource, { offset, limit, filter })
      return clayCollection({
        entities: rows.map((entity) => clayEntity(entity.toValue())),
        meta: {
          offset,
          limit,
          total: count,
          length: rows.length
        }
      })
    })
  }

  /** @inheritdoc */
  create (resourceName, attributes) {
    const s = this
    return co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let id = clayId()
      let entity = yield Entity.create({
        cid: String(id),
        ResourceId: resource.id
      })
      yield EntityAttribute.setAttributeValues(entity, attributes)
      return yield s.one(resourceName, id)
    })
  }

  /** @inheritdoc */
  update (resourceName, id, attributes) {
    const s = this
    return co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let entity = yield Entity.forOne(resource, String(id))
      yield EntityAttribute.setAttributeValues(entity, attributes)
      return yield s.one(resourceName, id)
    })
  }

  /** @inheritdoc */
  destroy (resourceName, id) {
    const s = this
    return co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let entity = yield Entity.forOne(resource, String(id))
      if (!entity) {
        return 0
      }
      yield entity.destroy()
      return 1
    })
  }

  /** @inheritdoc */
  drop (resourceName) {
    const s = this
    return co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      if (!resource) {
        return 0
      }
      yield Entity.destroy({
        where: { ResourceId: resource.id }
      })
      yield resource.destroy()
    })
  }

  /** @inheritdoc */
  resources () {
    const s = this
    return co(function * () {
      const { Resource } = yield s.getModels()
      let resources = yield Resource.findAll({})
      return resources.map((resource) => ({
        name: resource.name,
        version: 'latest' // TODO Support versioning
      }))
    })
  }

}

module.exports = SequelizeDriver
