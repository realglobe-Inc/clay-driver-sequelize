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
  usageModel,
  lockModel
} = require('./modeling')
const cluster = require('cluster')
const clayId = require('clay-id')
const clayEntity = require('clay-entity')
const clayCollection = require('clay-collection')
const {pageToOffsetLimit} = require('clay-list-pager')
const Sequelize = require('sequelize')
const cls = require('continuation-local-storage')
const clayResourceName = require('clay-resource-name')
const retry = require('retry-as-promised')
const queuePool = require('./helpers/queue_pool')
const {isProduction} = require('asenv')
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
    const db = new Sequelize(database, username, password, Object.assign({
      retry: {max: 15, match: ['SQLITE_BUSY: database is locked']},
    }, options))

    this._flushInterval = setInterval(async () => {
      try {
        const Usage = await this.getUsageModel()
        await Usage.flush()
      } catch (e) {
        // Do nothing
      }
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

    this._db = db
    this._models = {}
    this._modelWorking = {}

    const isSQLite = options && options.dialect === 'sqlite'
    this.queuePool = queuePool(isSQLite ? 1 : 50)

    process.setMaxListeners(process.getMaxListeners() + 1)
    process.on('message', async ({$$clay, $$from, $$resource, event, data}) =>
      this.handleClusterEvent({$$clay, $$from, $$resource, event, data})
    )
  }

  async do (resourceName, task) {
    const {db, queuePool} = this
    const queue = queuePool.next()
    return queue.push(async () => {
      const Lock = await this.getLockModel()
      const Resource = await this.getResourceModel()
      const resource = await Resource.ofName(resourceName)
      return await task({Lock, resource})
    })
  }

  get db () {
    const {_db: db} = this
    this.assertOpen()
    return db
  }

  assertOpen () {
    const {_db: db} = this
    if (db.closed) {
      if (!isProduction()) {
        console.trace(`[SequelizeDriver] DB access after closed`)
      }
      throw new Error(`DB Already closed`)
    }

  }

  /**
   * Data base configuration
   * @returns {object}
   */
  get config () {
    return this._db.config
  }

  async getEntityModels (resource) {
    const Resource = await this.getResourceModel()
    const Usage = await this.getUsageModel()
    const {name: resourceName} = resource
    const prefix = pascalcase(resourceName).replace(/_/g, '')
    if (this._models[prefix]) {
      return await this._models[prefix]
    }
    if (this._modelWorking[prefix]) {
      await Promise.resolve(this._modelWorking[prefix])
      return this.getEntityModels(resource)
    }
    await asleep(100 * Math.random()) // For cluster access
    return this._modelWorking[prefix] = (async () => {
      const {db} = this
      const Lock = await this.getLockModel()
      const lockName = `entity/${resourceName}`
      await Lock.waitToLock(lockName)
      let models = null
      await Lock.lockWhile(lockName, async () => {
        const usageCounts = await Usage.countsOf(resourceName)
        const Attribute = attributeModel({db, resourceName, prefix})
        const Entity = entityModel({db, resourceName, prefix, usageCounts})
        await Resource.sync()
        await asleep(10)
        await Entity.sync().catch(() => {
          console.warn(`Failed to sync model ${resourceName}`)
        })
        await Entity.Extra.sync()
        await asleep(10)
        await Attribute.sync()
        await asleep(100) // Wait to flush
        models = {Entity, Attribute}
      })
      this._models[prefix] = models
      this._modelWorking[prefix] = null
      return models
    })()
  }

  async getResourceModel () {
    if (this._models.Resource) {
      return await this._models.Resource
    }
    this._models.Resource = (async () => {
      const {db} = this
      const Resource = resourceModel({db})
      await Resource.sync()
      this._models.Resource = Resource
      return Resource
    })()
    return this.getResourceModel()
  }

  async getUsageModel () {
    if (this._models.Usage) {
      return await this._models.Usage
    }
    this._models.Usage = (async () => {
      const {db} = this
      const Usage = usageModel({db})
      await Usage.sync()
      this._models.Usage = Usage
      return Usage
    })()
    return this.getUsageModel()
  }

  async getLockModel () {
    if (this._models.Lock) {
      return await this._models.Lock
    }
    this._models.Lock = (async () => {
      const {db} = this
      const Lock = lockModel({db})
      await Lock.sync()
      if (cluster.isMaster) {
        await asleep(10)
        await Lock.unlockAll()
      }
      await asleep(10)
      this._models.Lock = Lock
      return Lock
    })()
    return this.getLockModel()
  }

  async one (resourceName, id) {
    if (!id) {
      return null
    }
    this.assertOpen()

    const Resource = await this.getResourceModel()
    const Usage = await this.getUsageModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await this.getEntityModels(resource)
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
    this.assertOpen()

    const Resource = await this.getResourceModel()
    const Usage = await this.getUsageModel()
    const resource = await Resource.ofName(resourceName)
    const {Entity, Attribute} = await this.getEntityModels(resource)
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
    this.assertOpen()
    const entity = await this.do(resourceName, async ({Lock, resource}) => {
      const {Entity, Attribute} = await this.getEntityModels(resource)
      const {id = clayId()} = attributes
      const cid = String(id)
      delete attributes.id
      const cols = await Attribute.colsFor(attributes, {Lock})
      const {base: baseValues, extra: extraValues} = Entity.valuesWithCols(cols)
      const entity = await Entity.create(Object.assign(
        {cid},
        baseValues
      ))
      await entity.createExtra(extraValues)
      return entity
    })
    return await this.one(resourceName, entity.cid)
  }

  async update (resourceName, id, attributes) {
    this.assertOpen()
    const entity = await this.do(resourceName, async ({Lock, resource}) => {
      const {Entity, Attribute} = await this.getEntityModels(resource)
      const cid = String(id)
      const entityAttributes = await Attribute.allOf()
      const entity = await Entity.forOne(entityAttributes, cid)
      if (!entity) {
        throw new Error(`Entity not found for ${id}`)
      }

      const prevAttributes = entity.asClay(entityAttributes)
      delete prevAttributes.id
      const prevCols = await Attribute.colsFor(prevAttributes, {Lock})
      const {extra: prevExtraValues} = Entity.valuesWithCols(prevCols)

      Entity.delCacheFor(cid)
      delete attributes.id
      const cols = await Attribute.colsFor(attributes, {Lock})
      const {base: baseValues, extra: extraValues} = Entity.valuesWithCols(cols)
      const filteredExtraValues = Entity.filterExtra(prevExtraValues, extraValues)

      await entity.update(baseValues)
      await entity.updateExtra(filteredExtraValues)
      Entity.delCacheFor(cid)
      return entity
    })
    await asleep(1)
    return await this.one(resourceName, entity.cid)
  }

  async destroy (resourceName, id) {
    this.assertOpen()
    return await this.do(resourceName, async ({Lock, resource}) => {
      const {Entity, Attribute} = await this.getEntityModels(resource)
      const entityAttributes = await Attribute.allOf()
      const cid = String(id)
      const entity = await Entity.forOne(entityAttributes, cid)
      if (!entity) {
        return 0
      }

      Entity.delCacheFor(cid)
      await entity.destroy()
      return 1
    })
  }

  async drop (resourceName) {
    this.assertOpen()
    const Resource = await this.getResourceModel()
    Resource.clearCacheForName(resourceName)
    const resource = await Resource.ofName(resourceName)
    if (!resource) {
      return 0
    }
    const {Entity, Attribute} = await this.getEntityModels(resource)
    await Entity.destroy({where: {}})
    await Attribute.destroy({where: {}})
    await resource.destroy()
    Resource.clearCacheForName(resourceName)
    await asleep(10)
  }

  async resources () {
    const Resource = await this.getResourceModel()
    const resources = await Resource.findAll({})
    return resources.map((resource) => {
      const {name, domain} = clayResourceName(resource)
      return {name, domain}
    })
  }

  async close () {
    this.assertOpen()

    const {_db: db} = this
    const {idle = 10} = (db.config.pool || {})

    clearTimeout(this._flushInterval)

    const Usage = await this.getUsageModel()
    await Usage.flush().catch(() => null)

    await Promise.all(Object.values(this._modelWorking))
    await this._models.Resource
    await this._models.Usage
    await this._models.Lock

    db.closed = true

    await asleep(idle + 10)
    await db.close()
    await asleep(idle + 10)
  }

  async handleClusterEvent ({$$clay, $$from, $$resource, event, data}) {
    if (!$$clay) {
      return
    }
    switch (event) {
      case INVALIDATE: {
        const {Entity} = await this.getEntityModels({name: $$resource})
        Entity.delCacheFor(data.id)
        break
      }
      case INVALIDATE_BULK: {
        const {Entity} = await this.getEntityModels({name: $$resource})
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
