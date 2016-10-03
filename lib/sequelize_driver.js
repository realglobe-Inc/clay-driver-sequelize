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
const { has, get, set, remove } = require('json-pointer')
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
      let created = yield Record.create({
        [RECORD_NAMEPATH]: namepath,
        [RECORD_KEY]: data[ RECORD_KEY ],
        [RECORD_VALUE]: serialize(data[ RECORD_VALUE ]),
        [RECORD_AT]: data[ RECORD_AT ],
        [RECORD_SEAL]: data[ RECORD_SEAL ],
        [RECORD_BY]: data[ RECORD_BY ]
      })
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
    const { Record } = s
    return co(function * () {
      s.assertConnected()

      let data = yield Record.findOne({
        where: {
          [RECORD_NAMEPATH]: namepath
        }
      })
      if (data) {
        return {
          [RECORD_VALUE]: deserialize(data[ RECORD_VALUE ]),
          [RECORD_AT]: data[ RECORD_AT ],
          [RECORD_SEAL]: data[ RECORD_SEAL ],
          [RECORD_BY]: data[ RECORD_BY ]
        }
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
    return co(function * () {
      s.assertConnected()
      let found = yield s.read(namepath)
      if (!found) {
        throw new Error(`[${DRIVER_PREFIX}] Not found: ${namepath}`)
      }
      // TODO
      throw new Error('Not implemented!')
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
      // TODO
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

  defineRecord (sequelize) {
    return sequelize.define('record', {
      [RECORD_NAMEPATH]: { type: STRING, allowNull: false },
      [RECORD_KEY]: { type: STRING, allowNull: false },
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

}

module.exports = SequelizeDriver
