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

const SequentialWorker = require('./helpers/sequential_worker')
const {Driver} = require('clay-driver-base')
const asleep = require('asleep')
const {resourceModel, attributeModel, entityModel} = require('./modeling')
const clayId = require('clay-id')
const clayEntity = require('clay-entity')
const clayCollection = require('clay-collection')
const {pageToOffsetLimit} = require('clay-list-pager')
const Sequelize = require('sequelize')
const cls = require('continuation-local-storage')
const clayResourceName = require('clay-resource-name')
const retry = require('retry-as-promised')
const queuePool = require('./helpers/queue_pool')
const {pascalcase} = require('stringcase')

Sequelize.useCLS(
  cls.createNamespace('clay:driver:sequelize-transaction')
)

/** @lends SequelizeDriver */
class SequelizeDriver extends Driver {
  constructor (database, username, password, options) {
    super()
    const s = this

    s.updateWorker = new SequentialWorker()

    const db = new Sequelize(database, username, password, options)

    // TODO model定義の方を直す
    db.define = ((oritinal) =>
      // Migration from sequelize v3 to v4
      function defineFallback (name, attributes, options = {}) {
        const {classMethods = {}, instanceMethods = {}} = options
        const defined = oritinal.call(db, name, attributes, Object.assign({}, options))
        Object.assign(defined, classMethods)
        Object.assign(defined.prototype, instanceMethods)
        return defined
      })(db.define)

    s._db = db
    s._models = {}
    s._modelWorking = {}

    const isSQLite = options && options.dialect === 'sqlite'
    s._queuePool = queuePool(isSQLite ? 1 : 5)
  }

  async getEntityModels (resource) {
    const s = this
    const Resource = await s.getResourceModel()
    const {name: resourceName} = resource
    const prefix = pascalcase(resourceName).replace(/_/g, '')
    if (s._models[prefix]) {
      return s._models[prefix]
    }
    while (s._modelWorking[prefix]) {
      await asleep(5)
    }
    s._modelWorking[prefix] = true
    const {_db: db} = s

    const Attribute = attributeModel({db, resourceName, prefix})
    const Entity = entityModel({db, resourceName, prefix})
    await Resource.sync()
    await Entity.sync()
    await Entity.Extra.sync()
    await Attribute.sync()
    await asleep(10)
    const models = {Entity, Attribute}
    s._models[prefix] = models
    s._modelWorking[prefix] = false
    return models
  }

  async getResourceModel () {
    const s = this
    if (!s._models.Resource) {
      const {_db: db} = s
      const Resource = resourceModel({db})
      await Resource.sync()
      s._models.Resource = Resource
    }
    return s._models.Resource
  }

  async one (resourceName, id) {
    const s = this
    if (!id) {
      return null
    }
    const Resource = await s.getResourceModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await s.getEntityModels(resource)
    const cid = String(id)

    const entityAttributes = await Attribute.allOf()
    const entity = await Entity.forOne(entityAttributes, cid)
    if (!entity) {
      Entity.forOneCache.del(Entity.cacheKeyFor(cid))
      return null
    }
    return clayEntity(entity.asClay(entityAttributes))
  }

  async list (resourceName, condition = {}) {
    const s = this
    const Resource = await s.getResourceModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await s.getEntityModels(resource)
    const entityAttributes = await Attribute.allOf()
    const {filter = {}, page = {}, sort = []} = condition
    const {limit, offset} = pageToOffsetLimit(page)
    const {rows, count} = await Entity.forList(entityAttributes, {offset, limit, filter, sort})
    return clayCollection({
      entities: rows.map((entity) => clayEntity(entity.asClay(entityAttributes))),
      meta: {
        offset,
        limit,
        total: count,
        length: rows.length
      }
    })
  }

  async create (resourceName, attributes) {
    const s = this
    const Resource = await s.getResourceModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await s.getEntityModels(resource)
    const {id = clayId()} = attributes
    const cid = String(id)
    delete attributes.id
    const cols = await Attribute.colsFor(attributes)
    const {base: baseValues, extra: extraValues} = Entity.valuesWithCols(cols)
    const entity = await Entity.create(Object.assign(
      {cid},
      baseValues
    ))
    await entity.createExtra(extraValues)

    return s.one(resourceName, entity.cid)
  }

  async update (resourceName, id, attributes) {
    const s = this
    const {updateWorker} = s
    return updateWorker.push(id, async () => {
      const Resource = await s.getResourceModel()
      const resource = await Resource.ofName(resourceName)
      const {Entity, Attribute} = await s.getEntityModels(resource)
      const entityAttributes = await Attribute.allOf()
      const cid = String(id)
      const entity = await Entity.forOne(entityAttributes, cid)
      if (!entity) {
        throw new Error(`Entity not found for ${id}`)
      }

      const prevAttributes = entity.asClay(entityAttributes)
      delete prevAttributes.id
      const prevCols = await Attribute.colsFor(prevAttributes)
      const {extra: prevExtraValues} = Entity.valuesWithCols(prevCols)

      Entity.forOneCache.del(Entity.cacheKeyFor(cid))
      delete attributes.id
      const cols = await Attribute.colsFor(attributes)
      const {base: baseValues, extra: extraValues} = Entity.valuesWithCols(cols)

      const filteredExtraValues = Entity.filterExtra(prevExtraValues, extraValues)

      await entity.update(baseValues)
      await entity.updateExtra(filteredExtraValues)
      Entity.forOneCache.del(Entity.cacheKeyFor(cid))
      await asleep(1)
    })
  }

  async destroy (resourceName, id) {
    const s = this
    const Resource = await s.getResourceModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await s.getEntityModels(resource)
    const entityAttributes = await Attribute.allOf()
    const cid = String(id)
    const entity = await Entity.forOne(entityAttributes, cid)
    if (!entity) {
      return 0
    }
    Entity.forOneCache.del(Entity.cacheKeyFor(cid))
    await entity.destroy()
    return 1
  }

  async drop (resourceName) {
    const s = this
    const Resource = await s.getResourceModel()
    Resource.clearCacheForName(resourceName)
    const resource = await Resource.ofName(resourceName)
    if (!resource) {
      return 0
    }
    const {Entity, Attribute} = await s.getEntityModels(resource)
    await Entity.destroy({where: {}})
    await Attribute.destroy({where: {}})
    await resource.destroy()
    Resource.clearCacheForName(resourceName)
  }

  async resources () {
    const s = this
    const Resource = await s.getResourceModel()
    const resources = await Resource.findAll({})
    return resources.map((resource) => {
      const {name, domain} = clayResourceName(resource)
      return {name, domain}
    })
  }

  async close () {
    const s = this
    s._db.close()
    await asleep(10)
  }
}

module.exports = SequelizeDriver
