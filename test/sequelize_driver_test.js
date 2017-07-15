/**
 * Test case for sequelizeDriver.
 * Runs with mocha.
 */
'use strict'

const SequelizeDriver = require('../lib/sequelize_driver.js')
const clayDriverTests = require('clay-driver-tests')
const clayLump = require('clay-lump')
const { EOL } = require('os')
const { ok, equal, deepEqual, strictEqual } = require('assert')
const path = require('path')
const { exec } = require('child_process')
const fs = require('fs')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

describe('sequelize-driver', function () {
  this.timeout(500000)
  let storage01 = `${__dirname}/../tmp/testing-driver.db`
  let storage02 = `${__dirname}/../tmp/testing-driver-2.db`
  let storage03 = `${__dirname}/../tmp/testing-driver-3.db`
  let storage04 = `${__dirname}/../tmp/testing-driver-4.db`
  let storage05 = `${__dirname}/../tmp/testing-driver-5.db`
  let storage06 = `${__dirname}/../tmp/testing-driver-6.db`
  let storage07 = `${__dirname}/../tmp/testing-driver-7.db`
  let storage08 = `${__dirname}/../tmp/testing-driver-8.db`
  let storage09 = `${__dirname}/../tmp/testing-driver-9.db`
  let storage10 = `${__dirname}/../tmp/testing-driver-10.db`

  before(async () => {
    let storages = [
      storage01,
      storage02,
      storage03,
      storage04,
      storage05,
      storage06,
      storage07,
      storage08,
      storage09,
      storage10
    ]
    for (let storage of storages) {
      rimraf.sync(storage)
      mkdirp.sync(path.dirname(storage))
    }
  })

  after(async () => {

  })

  it('Sequelize driver', async () => {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage01,
      dialect: 'sqlite',
      benchmark: true,
      logging: console.log
    })
    let created = await driver.create('User', {
      username: 'okunishinishi',
      birthday: new Date('1985/08/26')
    })
    ok(created)
    ok(created.id)
    let one = await driver.one('User', created.id)
    equal(String(one.id), String(created.id))

    let created2 = await driver.create('User', {
      username: 'hoge',
      birthday: new Date('1990/08/26')
    })

    let created3 = await driver.create('User', {
      username: 'foge',
      birthday: new Date('1983/08/26')
    })
    ok(created2.id !== created.id)
    equal(created.username, 'okunishinishi')

    equal(created2.$$as, 'User')
    ok(created2.$$at)

    {
      let list01 = await driver.list('User', {
        filter: {}
      })
      equal(String(list01.entities[ 0 ].id), String(created.id))
      equal(list01.entities[ 0 ].$$as, 'User')
      ok(list01.entities[ 0 ].$$at)
      ok(list01.meta)
      deepEqual(list01.meta, { offset: 0, limit: 100, total: 3, length: 3 })

      let list02 = await driver.list('User', {
        filter: { username: 'okunishinishi' }
      })
      ok(list02.meta)
      deepEqual(list02.meta, { offset: 0, limit: 100, total: 1, length: 1 })

      let list03 = await driver.list('User', {
        sort: [ 'birthday' ]
      })
      equal(list03.entities[ 0 ].username, 'foge')

      let list04 = await driver.list('User', {
        sort: [ '-birthday' ],
        page: { size: 2, number: 1 }
      })
      equal(list04.entities[ 0 ].username, 'hoge')
      deepEqual(list04.meta, { offset: 0, limit: 2, total: 3, length: 2 })
    }

    await driver.update('User', created2.id, { username: 'hogehoge' })

    {
      let beforeDestroy = await driver.one('User', created3.id)
      ok(beforeDestroy)
    }

    await driver.destroy('User', created3.id)

    {
      let afterDestroy = await driver.one('User', created3.id)
      ok(!afterDestroy)
    }

    {
      let byId = await driver.list('User', { filter: { id: created3.id } })
      ok(byId)
    }

    deepEqual(await driver.resources(), [ { name: 'User', domain: null } ])
    await driver.drop('User')
    deepEqual(await driver.resources(), [])

    await driver.drop('__invalid_resource_name__')

    {
      let hoge = await driver.create('Hoge', { id: 1 })
      equal(hoge.id, '1')
      let one = await driver.one('Hoge', hoge.id)
      equal(String(hoge.id), String(one.id))
    }
  })

// https://github.com/realglobe-Inc/clay-driver-sqlite/issues/5
  it('sqlite/issues/5', async () => {
    const lump = clayLump('hec-eye-alpha', {
      driver: new SequelizeDriver('hogehoge', '', '', {
        storage: storage03,
        dialect: 'sqlite',
        logging: false
      })
    })
    let User = lump.resource('user')
    await User.drop()
    let created = await User.create({ name: 'hoge' })
    let found = await User.first({ name: 'hoge' })
    let destroyed = await User.destroy(found.id)
    equal(destroyed, 1)
    let mustBeNull = await User.first({ name: 'hoge' })
    ok(!mustBeNull)
  })

  // https://github.com/realglobe-Inc/clay-resource/issues/28
  it('issues/28', async () => {
    const lump = clayLump('issue-28-lump', {
      driver: new SequelizeDriver('hoge', '', '', {
        storage: storage04,
        dialect: 'sqlite',
        benchmark: true,
        // logging: console.log,
        logging: false
      })
    })
    let Person = lump.resource('Person')
    await Person.createBulk([ {
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
      let people = await Person.list({ filter: { pid: 1 }, sort: [ 'age' ] })
      let ages = people.entities.map(p => p.age)
      deepEqual(ages, [ 1, 2, 3 ])
    }

    {
      let people = await Person.list({ filter: { pid: 1 }, sort: [ '-age' ] })
      let ages = people.entities.map(p => p.age)
      deepEqual(ages, [ 3, 2, 1 ])
    }
  })

  it('Nested attribute and refs', async () => {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage05,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })
    let d = new Date()
    let created = await driver.create('Foo', {
      bar: {
        b: false,
        n: 1,
        s: 'hoge',
        d
      }
    })
    equal(typeof created.bar.b, 'boolean')
    equal(typeof created.bar.n, 'number')
    equal(typeof created.bar.s, 'string')
    ok(created.bar.d instanceof Date)
    equal((await driver.list('Foo', { filter: { bar: { b: false } } })).meta.length, 1)
    equal((await driver.list('Foo', { filter: { bar: { n: 1 } } })).meta.length, 1)
    equal((await driver.list('Foo', { filter: { bar: { s: 'hoge' } } })).meta.length, 1)
    equal((await driver.list('Foo', { filter: { bar: { s: 'fuge' } } })).meta.length, 0)
    equal((await driver.list('Foo', { filter: { bar: { d } } })).meta.length, 1)

    await driver.drop('Foo')
    await driver.create('User', {
      name: 'user01',
      org: { $ref: 'Org#1' }
    })
    await driver.create('User', {
      name: 'user02',
      org: { $ref: 'Org#2' }
    })

    let list = await driver.list('User', {
      filter: {
        org: { $ref: 'Org#2' }
      }
    })
    equal(list.meta.length, 1)
    equal(list.entities[ 0 ].name, 'user02')

    await driver.drop('User')

    await driver.close()
  })

  it('Using operator', async () => {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage05,
      dialect: 'sqlite',
      benchmark: true,
      logging: false,
      // logging: console.log
    })
    await driver.create('Box', { size: 40 })
    await driver.create('Box', { size: 200 })
    await driver.create('Box', { size: 300 })

    equal(
      (await driver.list('Box', { filter: { size: { $gt: 200 } } })).meta.total,
      1
    )
    equal(
      (await driver.list('Box', { filter: { size: { $gte: 200 } } })).meta.total,
      2
    )
    equal(
      (await driver.list('Box', { filter: { size: { $in: [ 200 ] } } })).meta.total,
      1
    )
    equal(
      (await driver.list('Box', { filter: { size: { $between: [ 30, 210 ] } } })).meta.total,
      2
    )
  })

  // https://github.com/realglobe-Inc/claydb/issues/9
  it('claydb/issues/9', async () => {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage07,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    let user = await driver.create('User', {
      names: [ 'hoge', 'fuga' ],
      nested: [
        [ 'n-0-0', 'n-0-1' ],
        [ 'n-0-1', [ 'n-1-1-0', 'n-1-1-1' ] ]
      ]
    })
    ok(Array.isArray(user.names))
    deepEqual(user.names, [ 'hoge', 'fuga' ])

    deepEqual(user.nested, [
      [ 'n-0-0', 'n-0-1' ],
      [ 'n-0-1', [ 'n-1-1-0', 'n-1-1-1' ] ]
    ])
  })

  // https://github.com/realglobe-Inc/clay-driver-sequelize/issues/18#issuecomment-310563957
  it('issues/18', async () => {
    let driver = new SequelizeDriver('hoge', '', '', {
      storage: storage08,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    await driver.drop('User')
    await driver.create('User', { d: new Date('2017/06/22') })
    await driver.create('User', { d: new Date('2017/07/22') })
    await driver.create('User', { d: new Date('2017/08/22') })

    equal(
      (await driver.list('User', { filter: { d: { $gt: new Date('2017/07/23') } } })).meta.length,
      1
    )
    equal(
      (await driver.list('User', { filter: { d: { $gt: new Date('2017/06/23') } } })).meta.length,
      2
    )
    equal(
      (await driver.list('User', { filter: { d: { $between: [ new Date('2017/07/21'), new Date('2017/07/23') ] } } })).meta.length,
      1
    )
  })

  it('A lot of CRUD on sqlite', async () => {
    const log = fs.createWriteStream(`${__dirname}/../tmp/a-lot-of-CRUD.log`)
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage09,
      dialect: 'sqlite',
      benchmark: true,
      logging: (line) => log.write(line + EOL)
    })
    await driver.drop('Box')

    const NUMBER_OF_ENTITY = 50
    const NUMBER_OF_ATTRIBUTE = 10
    let ids = []

    // Create
    {
      let startAt = new Date()
      let creatingQueue = []
      for (let i = 0; i < NUMBER_OF_ENTITY; i++) {
        const attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
          .fill(null)
          .reduce((attr, _, j) => Object.assign(attr, {
            [`attr-${j}`]: j
          }), { index: i })
        creatingQueue.push(driver.create('Box', attributes))
      }
      ids.push(
        ...(await Promise.all(creatingQueue)).map(({ id }) => id)
      )
      console.log(`Took ${new Date() - startAt}ms for ${NUMBER_OF_ENTITY} entities, ${NUMBER_OF_ATTRIBUTE} attributes to create`)
    }
    // Update
    {
      let startAt = new Date()
      let updateQueue = []
      for (let id of ids) {
        let attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
          .fill(null)
          .reduce((attr, _, j) => Object.assign(attr, {
            [`attr-${j}`]: `${j}-updated`
          }), {})
        updateQueue.push(
          driver.update('Box', id, attributes)
        )
      }
      await Promise.all(updateQueue)
      console.log(`Took ${new Date() - startAt}ms for ${NUMBER_OF_ENTITY} entities, ${NUMBER_OF_ATTRIBUTE} attributes to update`)
    }

    await driver.close()

    log.end()
  })

  it('A lot of CRUD on mysql', async () => {
    async function resetMysqlDatabase (rootUsername, rootPassword, config = {}) {
      const escape = (value) => `${'\\`'}${value}${'\\`'}`
      let { username, password, database, host = 'localhost' } = config
      rootUsername = rootUsername || config.rootUsername || 'root'
      rootPassword = rootPassword || config.rootPassword
      let sql = `DROP DATABASE IF EXISTS ${database}; CREATE DATABASE IF NOT EXISTS ${database}; GRANT ALL ON ${escape(database)}.* TO '${username}'@'%' IDENTIFIED BY '${password}'`
      let command = `mysql -u${rootUsername} --host=${host} ${host === 'localhost' ? '' : '--protocol=tcp '}-e"${sql}"`
      let env = Object.assign({}, process.env)
      if (rootPassword) {
        env.MYSQL_PWD = rootPassword
      }
      let { stdout, stderr } = await new Promise((resolve, reject) =>
        exec(command, { env }, (err, stdout, stderr) =>
          err ? reject(err) : resolve({ stdout, stderr })
        )
      )
      if (stdout) {
        console.log(stdout)
      }
      if (stderr) {
        console.error(stderr)
      }
    }

    const DB_ROOT_USER = 'root'
    const DB_ROOT_PASSWORD = ''
    const DB_USER = 'hoge'
    const DB_PASSWORD = 'fuge'
    const DATABASE = 'clay_driver_sequelize_test'
    await resetMysqlDatabase(DB_ROOT_USER, DB_ROOT_PASSWORD, {
      database: DATABASE,
      username: DB_USER,
      password: DB_PASSWORD
    })

    let driver = new SequelizeDriver(DATABASE, DB_ROOT_USER, DB_ROOT_PASSWORD, {
      dialect: 'mysql',
      benchmark: true,
      logging: false
      // logging: console.log
    })
    await driver.drop('Box')

    const NUMBER_OF_ENTITY = 100
    const NUMBER_OF_ATTRIBUTE = 10
    for (let n = 0; n < 10; n++) {
      let ids = []
      // Create
      {
        let startAt = new Date()
        let creatingQueue = []
        let indexes = new Array(NUMBER_OF_ENTITY).fill(null).map((_, i) => i)
        for (const i of indexes) {
          let attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
            .fill(null)
            .reduce((attr, _, j) => Object.assign(attr, {
              [`attr-${j}`]: j
            }), { index: i })
          creatingQueue.push(driver.create('Box', attributes))
        }
        const result = await Promise.all(creatingQueue)
        ids.push(
          ...(result).map(({ id }) => id)
        )
        console.log(`Took ${new Date() - startAt}ms for ${NUMBER_OF_ENTITY} entities, ${NUMBER_OF_ATTRIBUTE} attributes to create`)
      }
      // Update
      {
        for (let i = 0; i < 2; i++) {
          let startAt = new Date()
          let updateQueue = []
          for (let id of ids) {
            let attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
              .fill(null)
              .reduce((attr, _, j) => Object.assign(attr, {
                [`attr-${j}`]: `${j}-updated-${i}`
              }), {})
            updateQueue.push(
              driver.update('Box', id, attributes)
            )
          }
          await Promise.all(updateQueue)
          console.log(`Took ${new Date() - startAt}ms for ${NUMBER_OF_ENTITY} entities, ${NUMBER_OF_ATTRIBUTE} attributes to update`)
        }
      }
    }

    await driver.close()
  })

  it('Update and one', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage10,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    const created = await driver.create('Color', { name: 'red', code: '#E11' })
    equal(created.code, '#E11')
    await driver.update('Color', created.id, { code: '#F11', name: 'red' })
    const updated = await driver.one('Color', created.id)
    equal(updated.code, '#F11')
  })
})

/* global describe, before, after, it */
