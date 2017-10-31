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

const {Driver} = require('clay-driver-base')
const asleep = require('asleep')
const {
  resourceModel,
  attributeModel,
  entityModel,
  usageModel
} = require('./modeling')
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

const {
  INVALIDATE,
  INVALIDATE_BULK,
} = require('clay-constants').ResourceEvents

Sequelize.useCLS(
  cls.createNamespace('clay:driver:sequelize-transaction')
)

/** @lends SequelizeDriver */
class SequelizeDriver extends Driver {
  constructor (database, username, password, options) {
    super()
    const s = this

    const db = new Sequelize(database, username, password, options)

    s._flushInterval = setInterval(async () => {
      const Usage = await s.getUsageModel()
      await Usage.flush()
    }, 5 * 100).unref()

    // TODO model定義の方を直す
    db.define = ((original) =>
      // Migration from sequelize v3 to v4
      function defineFallback (name, attributes, options = {}) {
        const {classMethods = {}, instanceMethods = {}} = options
        const defined = original.call(db, name, attributes, Object.assign({}, options))
        Object.assign(defined, classMethods)
        Object.assign(defined.prototype, instanceMethods)
        return defined
      })(db.define)

    s._db = db
    s._models = {}
    s._modelWorking = {}

    const isSQLite = options && options.dialect === 'sqlite'
    s._queuePool = queuePool(isSQLite ? 1 : 5)

    process.setMaxListeners(process.getMaxListeners() + 1)
    process.on('message', async ({$$clay, $$from, $$resource, event, data}) =>
      s.handleClusterEvent({$$clay, $$from, $$resource, event, data})
    )
  }

  /**
   * Data base configuration
   * @returns {object}
   */
  get config () {
    const s = this
    return s._db.config
  }

  async getEntityModels (resource) {
    const s = this
    const Resource = await s.getResourceModel()
    const Usage = await s.getUsageModel()
    const {name: resourceName} = resource
    const prefix = pascalcase(resourceName).replace(/_/g, '')
    if (s._models[prefix]) {
      return s._models[prefix]
    }
    if (s._modelWorking[prefix]) {
      await Promise.resolve(s._modelWorking[prefix])
      return s.getEntityModels(resource)
    }
    await asleep(10 * Math.random()) // For cluster access
    return s._modelWorking[prefix] = (async () => {
      const {_db: db} = s
      const usageCounts = await Usage.countsOf(resourceName)
      const Attribute = attributeModel({db, resourceName, prefix})
      const Entity = entityModel({db, resourceName, prefix, usageCounts})
      await Resource.sync()
      await Entity.sync()
      await Entity.Extra.sync()
      await Attribute.sync()
      await asleep(10) // Wait to flush
      const models = {Entity, Attribute}
      s._models[prefix] = models
      s._modelWorking[prefix] = null
      return models
    })()
  }

  async getResourceModel () {
    const s = this
    if (s._models.Resource) {
      return await s._models.Resource
    }
    s._models.Resource = (async () => {
      const {_db: db} = s
      const Resource = resourceModel({db})
      await Resource.sync()
      s._models.Resource = Resource
      return Resource
    })()
    return s.getResourceModel()
  }

  async getUsageModel () {
    const s = this
    if (s._models.Usage) {
      return await s._models.Usage
    }
    s._models.Usage = (async () => {
      const {_db: db} = s
      const Usage = usageModel({db})
      await Usage.sync()
      s._models.Usage = Usage
      return Usage
    })()
    return s.getUsageModel()
  }

  async one (resourceName, id) {
    const s = this
    if (!id) {
      return null
    }
    const Resource = await s.getResourceModel()
    const Usage = await s.getUsageModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await s.getEntityModels(resource)
    const cid = String(id)

    const entityAttributes = await Attribute.allOf()
    const entity = await Entity.forOne(entityAttributes, cid)
    if (!entity) {
      Entity.delCacheFor(cid)
      return null
    }
    Usage.push(resourceName, 'filter', ['id'])
    return clayEntity(entity.asClay(entityAttributes))
  }

  async list (resourceName, condition = {}) {
    const s = this
    const Resource = await s.getResourceModel()
    const Usage = await s.getUsageModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await s.getEntityModels(resource)
    const entityAttributes = await Attribute.allOf()
    const {filter = {}, page = {}, sort = []} = condition
    const {limit, offset} = pageToOffsetLimit(page)
    const {rows, count, order, where} = await Entity.forList(entityAttributes, {offset, limit, filter, sort})
    Usage.push(resourceName, 'whereCols', Object.keys(where))
    Usage.push(resourceName, 'orderCols', [].concat(order).map(([col]) => col))
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

    Entity.delCacheFor(cid)
    delete attributes.id
    const cols = await Attribute.colsFor(attributes)
    const {base: baseValues, extra: extraValues} = Entity.valuesWithCols(cols)

    const filteredExtraValues = Entity.filterExtra(prevExtraValues, extraValues)

    await entity.update(baseValues)
    await entity.updateExtra(filteredExtraValues)
    Entity.delCacheFor(cid)
    await asleep(1)
    return s.one(resourceName, entity.cid)
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
    Entity.delCacheFor(cid)
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
    const {_db: db} = s
    db.closed = true
    clearTimeout(s._flushInterval)

    const Usage = await s.getUsageModel()
    await Usage.flush()

    await asleep(100)
    db.close()

    await asleep(100)
  }

  async handleClusterEvent ({$$clay, $$from, $$resource, event, data}) {
    const s = this
    if (!$$clay) {
      return
    }
    switch (event) {
      case INVALIDATE: {
        const {Entity} = await s.getEntityModels({name: $$resource})
        Entity.delCacheFor(data.id)
        break
      }
      case INVALIDATE_BULK: {
        const {Entity} = await s.getEntityModels({name: $$resource})
        for (const id of data.ids || []) {
          Entity.delCacheFor(id)
        }
        break
      }
      default:
        break
    }
  }
}

module.exports = SequelizeDriver
