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
      dialect: 'sqlite',
      logging: true
    })
    let created = yield driver.create('users', {
      username: 'okunishinishi'
    })
    assert.ok(created)
    assert.ok(created.id)
    let created2 = yield driver.create('users', {
      username: 'hoge',
      birthday: new Date('1985/08/26')
    })

    let created3 = yield driver.create('users', {
      username: 'foge',
      birthday: new Date('1985/08/26')
    })
    assert.ok(created2.id !== created.id)
    assert.equal(created.username, 'okunishinishi')

    {
      let list01 = yield driver.list('users', {
        filter: {}
      })
      assert.ok(list01.meta)
      assert.deepEqual(list01.meta, { offset: 0, limit: 100, total: 3, length: 3 })

      let list02 = yield driver.list('users', {
        filter: { username: 'okunishinishi' }
      })
      assert.ok(list02.meta)
      assert.deepEqual(list02.meta, { offset: 0, limit: 100, total: 1, length: 1 })
    }

    yield driver.update('users', created2.id, { username: 'hogehoge' })

    yield driver.destroy('users', created3.id)

    yield driver.drop('users')
  }))
})

/* global describe, before, after, it */
