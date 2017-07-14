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
const { resourceModel, entityAttributeModel, entityModel } = require('./modeling')
const clayId = require('clay-id')
const clayEntity = require('clay-entity')
const clayCollection = require('clay-collection')
const { pageToOffsetLimit } = require('clay-list-pager')
const Sequelize = require('sequelize')
const cls = require('continuation-local-storage')
const clayResourceName = require('clay-resource-name')
const sgQueue = require('sg-queue')
const retry = require('retry-as-promised')
const { pascalcase } = require('stringcase')

const queue = sgQueue()

Sequelize.useCLS(
  cls.createNamespace('clay:driver:sequelize-transaction')
)

/** @lends SequelizeDriver */
class SequelizeDriver extends Driver {
  constructor (database, username, password, options) {
    super()
    const s = this

    const db = new Sequelize(database, username, password, options)

    // TODO model定義の方を直す
    db.define = ((oritinal) =>
      // Migration from sequelize v3 to v4
      function defineFallback (name, attributes, options = {}) {
        const { classMethods = {}, instanceMethods = {} } = options
        const defined = oritinal.call(db, name, attributes, Object.assign({}, options))
        Object.assign(defined, classMethods)
        Object.assign(defined.prototype, instanceMethods)
        return defined
      })(db.define)

    s._db = db
    s._models = {}
    s._modelWorking = {}

    // TODO Database lockを回避するためにqueuingしているが、あくまで暫定対処。
    // パフォーマンス的に残念、冗長化すると死ぬ等の問題があるので根本対策が必要
    s.transaction = (task) =>
      queue.push(() =>
        retry(() => db.transaction({}, task), {
          max: 3,
          timeout: 10000,
          match: null, // TODO Filter errors
          backoffBase: 100,
          backoffExponent: 1.5,
          report (msg, options) {
            if (options.$current > 1) {
              console.warn(msg)
            }
          },
          name: 'Clay Sequelize Transaction'
        })
      )
  }

  getEntityModels (resource) {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const prefix = pascalcase(resource.name).replace(/_/g, '')
      if (s._models[ prefix ]) {
        return s._models[ prefix ]
      }
      while (s._modelWorking[ prefix ]) {
        yield asleep(5)
      }
      s._modelWorking[ prefix ] = true
      const { _db: db } = s
      const EntityAttribute = entityAttributeModel({ db, Resource, prefix })
      const Entity = entityModel({ db, Resource, EntityAttribute, prefix })
      yield Resource.sync()
      yield Entity.sync()
      yield EntityAttribute.sync()
      yield asleep(10)
      const models = { Entity, EntityAttribute }
      s._models[ prefix ] = models
      s._modelWorking[ prefix ] = false
      return models
    })
  }

  getResourceModel () {
    const s = this
    return co(function * () {
      if (!s._models.Resource) {
        const { _db: db } = s
        const Resource = resourceModel({ db })
        yield Resource.sync()
        s._models.Resource = Resource
      }
      return s._models.Resource
    })
  }

  one (resourceName, id) {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const resource = yield Resource.ofName(resourceName)
      const { Entity } = yield s.getEntityModels(resource)
      let cid = String(id)
      let entity = yield Entity.forOne(resource, cid)
      if (!entity) {
        Entity.forOneCache.del(Entity.cacheKeyFor(resource, cid))
        return null
      }
      return clayEntity(entity.asClay())
    })
  }

  list (resourceName, condition = {}) {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const resource = yield Resource.ofName(resourceName)
      const { Entity } = yield s.getEntityModels(resource)
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
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const resource = yield Resource.ofName(resourceName)
      const { Entity, EntityAttribute } = yield s.getEntityModels(resource)
      const { id = clayId() } = attributes
      const cid = String(id)
      yield s.transaction(() => co(function * () {
        const entity = yield Entity.create({
          cid: cid,
          ResourceId: resource.id
        })
        attributes.id = cid
        yield EntityAttribute.setAttributeValues(entity, attributes)
      }))
      return yield s.one(resourceName, id)
    })
  }

  update (resourceName, id, attributes) {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const resource = yield Resource.ofName(resourceName)
      const { Entity, EntityAttribute } = yield s.getEntityModels(resource)
      let cid = String(id)
      const entity = yield Entity.forOne(resource, cid)
      Entity.forOneCache.del(Entity.cacheKeyFor(resource, cid))
      delete attributes.id
      yield s.transaction(() => co(function * () {
        yield EntityAttribute.setAttributeValues(entity, attributes)
      }))
      return yield s.one(resourceName, id)
    })
  }

  destroy (resourceName, id) {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const resource = yield Resource.ofName(resourceName)
      const { Entity } = yield s.getEntityModels(resource)
      let cid = String(id)
      const entity = yield Entity.forOne(resource, cid)
      if (!entity) {
        return 0
      }
      Entity.forOneCache.del(Entity.cacheKeyFor(resource, cid))
      return s.transaction(() => co(function * () {
        yield entity.destroy()
        return 1
      }))
    })
  }

  drop (resourceName) {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      Resource.clearCacheForName(resourceName)
      const resource = yield Resource.ofName(resourceName)
      if (!resource) {
        return 0
      }
      const { Entity } = yield s.getEntityModels(resource)
      return s.transaction(() => co(function * () {
        yield Entity.destroy({
          where: { ResourceId: resource.id }
        })
        yield resource.destroy()
        Resource.clearCacheForName(resourceName)
      }))
    })
  }

  resources () {
    const s = this
    return co(function * () {
      const Resource = yield s.getResourceModel()
      const resources = yield Resource.findAll({})
      return resources.map((resource) => {
        const { name, domain } = clayResourceName(resource)
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
