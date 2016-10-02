/**
 * Create driver instance
 * @function create
 * @param {...*} args
 * @returns {MemoryDriver}
 */
'use strict'

const SequelizeDriver = require('./sequelize_driver')

/** @lends create */
function create (...args) {
  return new SequelizeDriver(...args)
}

module.exports = create
