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
  let storage01 = `${__dirname}/../tmp/testing-driver.db`
  let storage02 = `${__dirname}/../tmp/testing-driver-2.db`
  let storage03 = `${__dirname}/../tmp/testing-driver-3.db`
  let storage04 = `${__dirname}/../tmp/testing-driver-4.db`
  let storage05 = `${__dirname}/../tmp/testing-driver-5.db`

  before(() => co(function * () {
    rimraf.sync(storage01)
    rimraf.sync(storage02)
    rimraf.sync(storage03)
    rimraf.sync(storage04)
    rimraf.sync(storage05)
    mkdirp.sync(path.dirname(storage01))
    mkdirp.sync(path.dirname(storage02))
    mkdirp.sync(path.dirname(storage03))
    mkdirp.sync(path.dirname(storage04))
    mkdirp.sync(path.dirname(storage05))
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
    let created = yield driver.create('User', {
      username: 'okunishinishi',
      birthday: new Date('1985/08/26')
    })
    ok(created)
    ok(created.id)
    let one = yield driver.one('User', created.id)
    console.log(one, created)
    equal(String(one.id), String(created.id))

    let created2 = yield driver.create('User', {
      username: 'hoge',
      birthday: new Date('1990/08/26')
    })

    let created3 = yield driver.create('User', {
      username: 'foge',
      birthday: new Date('1983/08/26')
    })
    ok(created2.id !== created.id)
    equal(created.username, 'okunishinishi')

    {
      let list01 = yield driver.list('User', {
        filter: {}
      })
      equal(String(list01.entities[ 0 ].id), String(created.id))
      ok(list01.meta)
      deepEqual(list01.meta, { offset: 0, limit: 100, total: 3, length: 3 })

      let list02 = yield driver.list('User', {
        filter: { username: 'okunishinishi' }
      })
      ok(list02.meta)
      deepEqual(list02.meta, { offset: 0, limit: 100, total: 1, length: 1 })

      let list03 = yield driver.list('User', {
        sort: [ 'birthday' ]
      })
      equal(list03.entities[ 0 ].username, 'foge')

      let list04 = yield driver.list('User', {
        sort: [ '-birthday' ]
      })
      equal(list04.entities[ 0 ].username, 'hoge')
    }

    yield driver.update('User', created2.id, { username: 'hogehoge' })

    yield driver.destroy('User', created3.id)

    {
      let byId = yield driver.list('User', { filter: { id: created3.id } })
      ok(byId)
    }

    deepEqual(yield driver.resources(), [ { name: 'User', version: 'latest' } ])
    yield driver.drop('User')
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

  // https://github.com/realglobe-Inc/clay-resource/issues/28
  it('issues/28', () => co(function * () {
    const lump = clayLump('issue-28-lump', {
      driver: new SequelizeDriver('hoge', '', '', {
        storage: storage04,
        dialect: 'sqlite',
        benchmark: true,
        logging: console.log
      })
    })
    let Person = lump.resource('Person')
    yield Person.createBulk([ {
      pid: 1,
      name: 'a',
      age: 2
    }, {
      pid: 1,
      name: 'b',
      age: 1
    }, {
      pid: 1,
      name: 'c',
      age: 3
    }, {
      pid: 2,
      name: 'd',
      age: 6
    } ])

    {
      let people = yield Person.list({ filter: { pid: 1 }, sort: [ 'age' ] })
      let ages = people.entities.map(p => p.age)
      deepEqual(ages, [ 1, 2, 3 ])
    }

    {
      let people = yield Person.list({ filter: { pid: 1 }, sort: [ '-age' ] })
      let ages = people.entities.map(p => p.age)
      deepEqual(ages, [ 3, 2, 1 ])
    }
  }))

  it('Nested attribute and refs', () => co(function * () {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage05,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })
    let created = yield driver.create('Foo', {
      bar: {
        b: false,
        n: 1,
        s: 'hoge',
        d: new Date()
      }
    })
    equal(typeof created.bar.b, 'boolean')
    equal(typeof created.bar.n, 'number')
    equal(typeof created.bar.s, 'string')
    ok(created.bar.d instanceof Date)

    yield driver.drop('Foo')
    yield driver.create('User', {
      name: 'user01',
      org: { $ref: 'Org#1' }
    })
    yield driver.create('User', {
      name: 'user02',
      org: { $ref: 'Org#2' }
    })
    yield driver.drop('User')
  }))
})

/* global describe, before, after, it */
