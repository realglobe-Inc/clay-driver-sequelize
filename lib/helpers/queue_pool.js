/**
 * Create a queue pool
 * @function queuePool
 */
'use strict'

const sgQueue = require('sg-queue')
class QueuePool {
  constructor (count = 5, options = {}) {
    this.pools = new Array(count).fill(null).map(() => sgQueue())
    this.index = 0
  }

  next () {
    const index = (this.index + 1) % this.pools.length
    this.index = index
    return this.pools[ index ]
  }
}

/** @lends queuePool */
function queuePool (count, options = {}) {
  return new QueuePool(count, options)
}

module.exports = queuePool
