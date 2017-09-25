/**
 * @class SequentialWorker
 */
'use strict'

const abind = require('abind')
const asleep = require('asleep')

class SequentialWorker {
  constructor (options = {}) {
    const s = this
    abind(s)
    const {
      interval = 10,
      timeout = 60 * 60 * 1000
    } = options
    s.interval = interval
    s.timeout = timeout
    s.busyHash = {}
  }

  async push (id, task) {
    const s = this
    const {interval, timeout} = s
    const startAt = new Date()
    while (s.busyHash[id]) {
      asleep(interval)
      const tooLong = timeout < new Date() - startAt
      if (tooLong) {
        throw new Error(`[SequentialWorker] ${timeout}ms exceeded`)
      }
    }
    s.busyHash[id] = true
    let result
    try {
      result = await task()
    } finally {
      s.busyHash[id] = false
    }
    return result
  }
}

module.exports = SequentialWorker
