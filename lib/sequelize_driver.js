/**
 * Abstract driver
 * @augments Driver
 * @class SequelizeDriver
 * @param {string} database - Name of database
 * @param {string} username - Database username
 * @param {string} password - Database password
 * @param {Object} [options={}] - Optional settings
 * @see https://github.com/sequelize/sequelize#readme
 */
'use strict'

const { Driver } = require('clay-driver-base')
const asleep = require('asleep')
const co = require('co')
const { defineModels } = require('./modeling')
const clayId = require('clay-id')
const clayEntity = require('clay-entity')
const clayCollection = require('clay-collection')
const { pageToOffsetLimit } = require('clay-list-pager')
const Sequelize = require('sequelize')
const cls = require('continuation-local-storage')
const clayResourceName = require('clay-resource-name')
const { LogPrefixes } = require('clay-constants')

Sequelize.useCLS(
  cls.createNamespace('clay:driver:sequelize-transaction')
)

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
    s.transaction = (...args) => db.transaction(...args)
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

  one (resourceName, id) {
    const s = this
    return co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let entity = yield Entity.forOne(resource, String(id))
      if (!entity) {
        return null
      }
      return clayEntity(entity.asClay())
    })
  }

  list (resourceName, condition = {}) {
    const s = this
    return co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let { filter = {}, page = {}, sort = [] } = condition
      let { limit, offset } = pageToOffsetLimit(page)
      let { rows, count } = yield Entity.forList(resource, { offset, limit, filter, sort })
      return clayCollection({
        entities: rows.map((entity) => clayEntity(entity.asClay())),
        meta: {
          offset,
          limit,
          total: count,
          length: rows.length
        }
      })
    })
  }

  create (resourceName, attributes) {
    const s = this
    return s.transaction(() => co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let { id = clayId() } = attributes
      let entity = yield Entity.create({
        cid: String(id),
        ResourceId: resource.id
      })
      attributes.id = String(id)
      yield EntityAttribute.setAttributeValues(entity, attributes)
      return yield s.one(resourceName, id)
    }))
  }

  update (resourceName, id, attributes) {
    const s = this
    return s.transaction(() => co(function * () {
      const { Resource, Entity, EntityAttribute } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let entity = yield Entity.forOne(resource, String(id))
      delete attributes.id
      yield EntityAttribute.setAttributeValues(entity, attributes)
      return yield s.one(resourceName, id)
    }))
  }

  destroy (resourceName, id) {
    const s = this
    return s.transaction(() => co(function * () {
      const { Resource, Entity } = yield s.getModels()
      let resource = yield Resource.ofName(resourceName)
      let entity = yield Entity.forOne(resource, String(id))
      if (!entity) {
        return 0
      }
      yield entity.destroy()
      return 1
    }))
  }

  drop (resourceName) {
    const s = this
    return s.transaction(() => co(function * () {
      const { Resource, Entity } = yield s.getModels()
      Resource.clearCacheForName(resourceName)
      let resource = yield Resource.ofName(resourceName)
      if (!resource) {
        return 0
      }
      yield Entity.destroy({
        where: { ResourceId: resource.id }
      })
      yield resource.destroy()
      Resource.clearCacheForName(resourceName)
    }))
  }

  resources () {
    const s = this
    return co(function * () {
      const { Resource } = yield s.getModels()
      let resources = yield Resource.findAll({})
      return resources.map((resource) => {
        let { name, domain } = clayResourceName(resource)
        return { name, domain }
      })
    })
  }

  close () {
    const s = this
    return co(function * () {
      s._db.close()
      yield asleep(10)
    })
  }

}

module.exports = SequelizeDriver
