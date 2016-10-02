/**
 * Test case for sequelizeDriver.
 * Runs with mocha.
 */
'use strict'

const SequelizeDriver = require('../lib/sequelize_driver.js')
const assert = require('assert')
const co = require('co')

describe('sequelize-driver', function () {
  this.timeout(3000)

  before(() => co(function * () {

  }))

  after(() => co(function * () {

  }))

  it('Sequelize driver', () => co(function * () {
    let driver = new SequelizeDriver()
    yield driver.connect({
      dialect: 'sqlite',
      storage: `${__dirname}/../tmp/testing-db-01.db`
    })
    yield driver.disconnect()
  }))
})

/* global describe, before, after, it */
