/**
 * Create a queue pool
 * @function queuePool
 */
'use strict'

const sgQueue = require('sg-queue')
class QueuePool {
  constructor (count = 5, options = {}) {
    const s = this
    s.pools = new Array(count).fill(null).map(() => sgQueue())
    s.index = 0
  }

  next () {
    const s = this
    const index = (s.index + 1) % s.pools.length
    s.index = index
    return s.pools[ index ]
  }
}

/** @lends queuePool */
function queuePool (count, options = {}) {
  return new QueuePool(count, options)
}

module.exports = queuePool
