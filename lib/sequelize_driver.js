/**
 * Abstract driver
 * @augments Driver
 * @class SequelizeDriver
 */
'use strict'

const { Driver } = require('clay-driver-base')
const co = require('co')
const abind = require('abind')
const Sequelize = require('sequelize')
const { LogPrefixes, RecordCols } = require('clay-constants')

const { DRIVER_PREFIX } = LogPrefixes
const {
  RECORD_KEY,
  RECORD_VALUE,
  RECORD_AT,
  RECORD_SEAL,
  RECORD_BY
} = RecordCols

const { STRING, TEXT, DATE } = Sequelize

const RECORD_NAMEPATH = 'namepath'

const serialize = (value) => typeof value === 'string' ? value : JSON.stringify(value)
const deserialize = (value) => typeof value === 'string' ? JSON.parse(value) : value

/** @lends SequelizeDriver */
class SequelizeDriver extends Driver {

// ---------------------
// Basic Interfaces
// ---------------------
  constructor () {
    super()
    const s = this
    s.sequelize = null
    abind(s)
  }

  /**
   * Connect driver
   * @param {...*} args - Sequelize arguments
   * @returns {Promise}
   */
  connect (...args) {
    const s = this
    if (s.sequelize) {
      throw new Error(`${DRIVER_PREFIX} sequelize already connected`)
    }
    return co(function * () {
      let sequelize = new Sequelize(...args)

      let Record = s.defineRecord(sequelize)

      yield Record.sync()

      Object.assign(s, {
        Record, sequelize
      })
      return s
    })
  }

  disconnect () {
    const s = this
    return co(function * () {
      let { sequelize } = s
      s.assertConnected()
      sequelize.close()
      return s
    })
  }

  // ---------------------
  // CRUD Interfaces
  // ---------------------

  /**
   * Create data with namepath
   * @param {string} namepath - Namepath string
   * @param {Object} data - Resource data to create
   * @returns {Promise}
   */
  create (namepath, data) {
    const s = this
    const { Record } = s
    return co(function * () {
      s.assertConnected()
      let found = yield s.read(namepath)
      if (found) {
        throw new Error(`${DRIVER_PREFIX} Already used: ${namepath}`)
      }
      let attributes = s.recordAttributes(namepath, data)
      let created = yield Record.create(attributes)
      return created
    })
  }

  /**
   * Read data with namepath
   * @param {string} namepath - Namepath string
   * @returns {Promise}
   */
  read (namepath) {
    const s = this
    return co(function * () {
      s.assertConnected()

      let record = yield s.findRecord(namepath)
      if (record) {
        return s.formatRecord(record)
      }

      let records = yield s.findAllRecords({ $like: `${namepath}/%` })
      if (records.length > 0) {
        return records.reduce((asHash, record) => Object.assign(asHash, {
          [record.namepath.substr(namepath.length).replace(/^\//, '')]: s.formatRecord(record)
        }), {})
      }
      return null
    })
  }

  /**
   * Update data with namepath
   * @param {string} namepath - Namepath string
   * @param {Object} data - Resource data to create
   * @returns {Promise}
   */
  update (namepath, data) {
    const s = this
    const unchangableKeys = [ RECORD_NAMEPATH, RECORD_KEY ]
    return co(function * () {
      s.assertConnected()
      let record = yield s.findRecord(namepath)
      if (!record) {
        throw new Error(`${DRIVER_PREFIX} Not found: ${namepath}`)
      }

      for (let key of unchangableKeys) {
        let changed = data.hasOwnProperty(key) && (data[ key ] !== record[ key ])
        if (changed) {
          throw new Error(`${DRIVER_PREFIX} Updating "${key}" is not allowed`)
        }
      }

      let attributes = s.recordAttributes(namepath, data)
      yield record.update(attributes, {})
      return s.read(namepath)
    })
  }

  /**
   * Delete data with namepath
   * @param {string} namepath - Namepath string
   * @returns {Promise}
   */
  delete (namepath) {
    const s = this
    return co(function * () {
      s.assertConnected()
      let record = yield s.findRecord(namepath)
      if (!record) {
        throw new Error(`${DRIVER_PREFIX} Not found: ${namepath}`)
      }
      return yield record.destroy()
    })
  }

  // ---------------------
  // Other Interfaces
  // ---------------------

  /**
   * Get cursor to iterate
   * @param {string} namepath - Namepath string
   * @param {Object} options - Optional settings
   * @returns {Promise.<Driver.Cursor>}
   */
  cursor (namepath, options = {}) {
    const s = this
    return co(function * () {
      s.assertConnected()
      throw new Error('Not implemented!')
    })
  }

  // ---------------------
  // Custom methods
  // ---------------------
  /**
   * Assert that driver connected
   */
  assertConnected () {
    const s = this
    if (!s.sequelize) {
      throw new Error(`${DRIVER_PREFIX} Driver not connected`)
    }
  }

  /**
   * Define a record model
   * @param {Sequelize} sequelize - A Sequelize instance.
   * @returns {Object} - Record model definition.
   */
  defineRecord (sequelize) {
    return sequelize.define('record', {
      [RECORD_NAMEPATH]: { type: STRING, allowNull: false, unique: true },
      [RECORD_KEY]: { type: STRING, allowNull: false, unique: true },
      [RECORD_VALUE]: { type: TEXT },
      [RECORD_AT]: { type: DATE, allowNull: false },
      [RECORD_SEAL]: { type: TEXT },
      [RECORD_BY]: { type: STRING }
    }, {
      indexes: [
        { unique: true, fields: [ RECORD_KEY ] }
      ]
    })
  }

  /**
   * Create attributes of a record instance
   * @param {string} namepath
   * @param {Object} data
   * @returns {Object}
   */
  recordAttributes (namepath, data) {
    const keysToCopy = [
      [ RECORD_KEY, null ],
      [ RECORD_VALUE, serialize ],
      [ RECORD_AT, null ],
      [ RECORD_SEAL, null ],
      [ RECORD_BY, null ]
    ]

    let record = {
      [RECORD_NAMEPATH]: namepath
    }

    for (let [key, formatter] of keysToCopy) {
      let has = data.hasOwnProperty(key)
      if (!has) {
        continue
      }
      let value = data[ key ]
      record[ key ] = formatter ? formatter(value) : value
    }
    return record
  }

  findRecord (namepath) {
    const s = this
    const { Record } = s
    return co(function * () {
      let record = yield Record.findOne({
        where: {
          [RECORD_NAMEPATH]: namepath
        }
      })
      return record
    })
  }

  findAllRecords (namepath) {
    const s = this
    const { Record } = s
    return co(function * () {
      let records = yield Record.findAll({
        where: {
          [RECORD_NAMEPATH]: namepath
        }
      })
      return records
    })
  }

  formatRecord (record) {
    return {
      [RECORD_VALUE]: deserialize(record[ RECORD_VALUE ]),
      [RECORD_AT]: record[ RECORD_AT ],
      [RECORD_SEAL]: record[ RECORD_SEAL ],
      [RECORD_BY]: record[ RECORD_BY ]
    }
  }

}

module.exports = SequelizeDriver
