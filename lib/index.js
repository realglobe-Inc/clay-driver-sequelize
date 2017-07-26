/**
 * Clay driver for Sequelize
 * @module clay-driver-sequelize
 * @version 5.0.12
 */

'use strict'

const create = require('./create')
const SequelizeDriver = require('./sequelize_driver')

let lib = create.bind(this)

Object.assign(lib, SequelizeDriver, {
  create,
  SequelizeDriver
})

module.exports = lib
