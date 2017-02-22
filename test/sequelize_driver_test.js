/**
 * Test case for sequelizeDriver.
 * Runs with mocha.
 */
'use strict'

const SequelizeDriver = require('../lib/sequelize_driver.js')
const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')

const co = require('co')

describe('sequelize-driver', function () {
  this.timeout(3000)
  let db
  let storage = `${__dirname}/../tmp/testing-driver.db`

  before(() => co(function * () {
    mkdirp.sync(path.dirname(storage))
  }))

  after(() => co(function * () {

  }))

  it('Sequelize driver', () => co(function * () {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage,
      dialect: 'sqlite'
    })
    let created = yield driver.create('users', {
      username: 'okunishinishi'
    })
    assert.ok(created)
    assert.ok(created.id)
    let created2 = yield driver.create('users', {
      username: 'hoge'
    })
    assert.ok(created2.id !== created.id)
    assert.equal(created.username, 'okunishinishi')
  }))
})

/* global describe, before, after, it */
