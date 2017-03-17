/**
 * Test case for sequelizeDriver.
 * Runs with mocha.
 */
'use strict'

const SequelizeDriver = require('../lib/sequelize_driver.js')
const clayDriverTests = require('clay-driver-tests')
const clayLump = require('clay-lump')
const { ok, equal, deepEqual, strictEqual } = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const co = require('co')

describe('sequelize-driver', function () {
  this.timeout(3000)
  let db
  let storage01 = `${__dirname}/../tmp/testing-driver.db`
  let storage02 = `${__dirname}/../tmp/testing-driver-2.db`
  let storage03 = `${__dirname}/../tmp/testing-driver-3.db`

  before(() => co(function * () {
    rimraf.sync(storage01)
    rimraf.sync(storage02)
    rimraf.sync(storage03)
    mkdirp.sync(path.dirname(storage01))
    mkdirp.sync(path.dirname(storage02))
    mkdirp.sync(path.dirname(storage03))
  }))

  after(() => co(function * () {

  }))

  it('Sequelize driver', () => co(function * () {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage01,
      dialect: 'sqlite',
      benchmark: true,
      logging: console.log
    })
    let created = yield driver.create('users', {
      username: 'okunishinishi',
      birthday: new Date('1985/08/26')
    })
    ok(created)
    ok(created.id)
    let one = yield driver.one('users', created.id)
    equal(String(one.id), String(created.id))

    let created2 = yield driver.create('users', {
      username: 'hoge',
      birthday: new Date('1990/08/26')
    })

    let created3 = yield driver.create('users', {
      username: 'foge',
      birthday: new Date('1983/08/26')
    })
    ok(created2.id !== created.id)
    equal(created.username, 'okunishinishi')

    {
      let list01 = yield driver.list('users', {
        filter: {}
      })
      equal(String(list01.entities[ 0 ].id), String(created.id))
      ok(list01.meta)
      deepEqual(list01.meta, { offset: 0, limit: 100, total: 3, length: 3 })

      let list02 = yield driver.list('users', {
        filter: { username: 'okunishinishi' }
      })
      ok(list02.meta)
      deepEqual(list02.meta, { offset: 0, limit: 100, total: 1, length: 1 })

      let list03 = yield driver.list('users', {
        sort: [ 'birthday' ]
      })
      equal(list03.entities[ 0 ].username, 'foge')

      let list04 = yield driver.list('users', {
        sort: [ '-birthday' ]
      })
      equal(list04.entities[ 0 ].username, 'okunishinishi')
    }

    yield driver.update('users', created2.id, { username: 'hogehoge' })

    yield driver.destroy('users', created3.id)

    deepEqual(yield driver.resources(), [ { name: 'users', version: 'latest' } ])
    yield driver.drop('users')
    deepEqual(yield driver.resources(), [])

    yield driver.drop('__invalid_resource_name__')
  }))

// https://github.com/realglobe-Inc/clay-driver-sqlite/issues/5
  it('sqlite/issues/5', () => co(function * () {
    const lump = clayLump('hec-eye-alpha', {
      driver: new SequelizeDriver('hogehoge', '', '', {
        storage: storage03,
        dialect: 'sqlite',
        logging: false
      })
    })
    let User = lump.resource('user')
    yield User.drop()
    let created = yield User.create({ name: 'hoge' })
    let found = yield User.first({ name: 'hoge' })
    let destroyed = yield User.destroy(found.id)
    equal(destroyed, 1)
    let mustBeNull = yield User.first({ name: 'hoge' })
    ok(!mustBeNull)
  }))
})

/* global describe, before, after, it */
