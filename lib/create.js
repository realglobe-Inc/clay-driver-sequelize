/**
 * Create driver instance
 * @function create
 * @param {...*} args
 * @returns {MemoryDriver}
 */
'use strict'

const MemoryDriver = require('./memory_driver')

/** @lends create */
function create (...args) {
  return new MemoryDriver(...args)
}

module.exports = create
