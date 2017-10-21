/**
 * Test case for sequelizeDriver.
 * Runs with mocha.
 */
'use strict'

const SequelizeDriver = require('../lib/sequelize_driver.js')
const clayDriverTests = require('clay-driver-tests')
const clayLump = require('clay-lump')
const {EOL} = require('os')
const {ok, equal, deepEqual, strictEqual} = require('assert')
const path = require('path')
const {exec} = require('child_process')
const fs = require('fs')
const asleep = require('asleep')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

describe('sequelize-driver', function () {
  this.timeout(80000)
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
  let storage11 = `${__dirname}/../tmp/testing-driver-11.db`
  let storage12 = `${__dirname}/../tmp/testing-driver-12.db`
  let storage13 = `${__dirname}/../tmp/testing-driver-13.db`
  let storage14 = `${__dirname}/../tmp/testing-driver-14.db`

  before(async () => {
    const storages = [
      storage01,
      storage02,
      storage03,
      storage04,
      storage05,
      storage06,
      storage07,
      storage08,
      storage09,
      storage10,
      storage11,
      storage12,
      storage13,
      storage14,
    ]
    for (let storage of storages) {
      rimraf.sync(storage)
      mkdirp.sync(path.dirname(storage))
    }
  })

  after(async () => {

  })

  it('Sequelize driver', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage01,
      dialect: 'sqlite',
      benchmark: true,
      logging: console.log
    })

    ok(driver.config)

    equal(driver.config.database, 'hoge')

    const created = await driver.create('User', {
      username: 'okunishinishi',
      birthday: new Date('1985/08/26')
    })
    ok(created)
    ok(created.id)
    ok(created.$$num)
    const one = await driver.one('User', created.id)
    equal(String(one.id), String(created.id))

    await asleep(10)
    const created2 = await driver.create('User', {
      username: 'hoge',
      birthday: new Date('1990/08/26')
    })

    await asleep(10)
    const created3 = await driver.create('User', {
      username: 'foge',
      birthday: new Date('1983/08/26')
    })
    ok(created2.id !== created.id)
    equal(created.username, 'okunishinishi')

    equal(created2.$$as, 'User')
    ok(created2.$$at)

    {
      const {entities} = await driver.list('User', {filter: {$$num: created3.$$num}})
      equal(entities.length, 1)
      equal(String(entities[0].id), String(created3.id))
    }

    {
      const {entities} = await driver.list('User', {sort: ['-$$at']})
      equal(entities.length, 3)
      equal(String(entities[0].id), String(created3.id))
      equal(String(entities[1].id), String(created2.id))
    }

    {
      let list01 = await driver.list('User', {
        filter: {}
      })
      equal(String(list01.entities[0].id), String(created.id))
      equal(list01.entities[0].$$as, 'User')
      ok(list01.entities[0].$$at)
      ok(list01.meta)
      deepEqual(list01.meta, {offset: 0, limit: 100, total: 3, length: 3})

      let list02 = await driver.list('User', {
        filter: {$or: [{username: 'okunishinishi'}]}
      })
      ok(list02.meta)
      deepEqual(list02.meta, {offset: 0, limit: 100, total: 1, length: 1})

      let list03 = await driver.list('User', {
        sort: ['birthday']
      })
      equal(list03.entities[0].username, 'foge')

      let list04 = await driver.list('User', {
        sort: ['-birthday'],
        page: {size: 2, number: 1}
      })
      equal(list04.entities[0].username, 'hoge')
      deepEqual(list04.meta, {offset: 0, limit: 2, total: 3, length: 2})

      let list05 = await driver.list('User', {
        filter: {'__unknown_column__': 0}
      })
      deepEqual(list05.meta, {offset: 0, limit: 100, total: 3, length: 3})

      let list06 = await driver.list('User', {
        filter: {id: created2.id}
      })
      deepEqual(list06.meta, {offset: 0, limit: 100, total: 1, length: 1})
    }

    await driver.update('User', created2.id, {username: 'hogehoge'})

    {
      let beforeDestroy = await driver.one('User', created3.id)
      ok(beforeDestroy)
      ok(beforeDestroy.$$num)
    }

    await driver.destroy('User', created3.id)

    {
      let afterDestroy = await driver.one('User', created3.id)
      ok(!afterDestroy)
    }

    {
      let byId = await driver.list('User', {filter: {id: created3.id}})
      ok(byId)
    }

    deepEqual(await driver.resources(), [{name: 'User', domain: null}])
    await driver.drop('User')
    deepEqual(await driver.resources(), [])

    await driver.drop('__invalid_resource_name__')

    {
      let hoge = await driver.create('Hoge', {id: 1})
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
    let created = await User.create({name: 'hoge'})
    let found = await User.first({name: 'hoge'})
    let destroyed = await User.destroy(found.id)
    equal(destroyed, 1)
    let mustBeNull = await User.first({name: 'hoge'})
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
    await Person.createBulk([{
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
    }])

    {
      let people = await Person.list({filter: {pid: 1}, sort: ['age']})
      let ages = people.entities.map(p => p.age)
      deepEqual(ages, [1, 2, 3])
    }

    {
      let people = await Person.list({filter: {pid: 1}, sort: ['-age']})
      let ages = people.entities.map(p => p.age)
      deepEqual(ages, [3, 2, 1])
    }
  })

  it('Nested attribute and refs', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage05,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })
    let d = new Date()
    await driver.drop('Foo')
    let created = await driver.create('Foo', {
      bar: {
        b: false,
        n: 1,
        s: 'hoge',
      },
      d
    })
    equal(typeof created.bar.b, 'boolean')
    equal(typeof created.bar.n, 'number')
    equal(typeof created.bar.s, 'string')
    ok(created.d instanceof Date)

    equal((await driver.list('Foo', {filter: {d}})).meta.length, 1)

    await driver.drop('Foo')
    {
      await driver.create('User', {
        name: 'user01',
        org: {$ref: 'Org#1'}
      })
      await driver.create('User', {
        name: 'user02',
        org: {$ref: 'Org#2'}
      })

      let list = await driver.list('User', {
        filter: {
          org: {$ref: 'Org#2'}
        }
      })
      equal(list.meta.length, 1)
      equal(list.entities[0].name, 'user02')

      await driver.drop('User')
    }

    {
      const org01 = await driver.create('Org', {name: 'org01'})
      const org02 = await driver.create('Org', {name: 'org02'})
      const user01 = await driver.create('User', {name: 'user01', org: org01})
      const user02 = await driver.create('User', {name: 'user02', org: org02})
      const user03 = await driver.create('User', {name: 'user03', org: org02})

      const org01Users = await driver.list('User', {filter: {org: org01}})
      equal(org01Users.entities.length, 1)
      equal(org01Users.entities[0].name, 'user01')

      const org02Users = await driver.list('User', {filter: {org: org02}})
      equal(org02Users.entities.length, 2)
      equal(org02Users.entities[1].name, 'user03')
      equal(org02Users.entities[1].org.$ref, `Org#${org02.id}`)

      const org01And02Users = await driver.list('User', {filter: {org: [org01, org02]}})
      equal(org01And02Users.entities.length, 3)
    }

    await driver.close()
  })

  it('Using operator', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage05,
      dialect: 'sqlite',
      benchmark: true,
      logging: false,
      // logging: console.log
    })
    await driver.create('Box', {size: 40})
    await driver.create('Box', {size: 200})
    await driver.create('Box', {size: 300})

    equal(
      (await driver.list('Box', {filter: {size: {$gt: 200}}})).meta.total,
      1
    )
    equal(
      (await driver.list('Box', {filter: {size: {$gte: 200}}})).meta.total,
      2
    )

    equal(
      (await driver.list('Box', {filter: {size: {$in: [200]}}})).meta.total,
      1
    )
    equal(
      (await driver.list('Box', {filter: {size: {$between: [30, 210]}}})).meta.total,
      2
    )
  })

  // https://github.com/realglobe-Inc/claydb/issues/9
  it('claydb/issues/9', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage07,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    let user = await driver.create('User', {
      names: ['hoge', 'fuga'],
      nested: [
        ['n-0-0', 'n-0-1'],
        ['n-0-1', ['n-1-1-0', 'n-1-1-1']]
      ]
    })
    ok(Array.isArray(user.names))
    deepEqual(user.names, ['hoge', 'fuga'])

    deepEqual(user.nested, [
      ['n-0-0', 'n-0-1'],
      ['n-0-1', ['n-1-1-0', 'n-1-1-1']]
    ])
  })

  // https://github.com/realglobe-Inc/clay-driver-sequelize/issues/18#issuecomment-310563957
  it('issues/18', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage08,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    await driver.drop('User')
    await driver.create('User', {d: new Date('2017/06/22')})
    await driver.create('User', {d: new Date('2017/07/22')})
    await driver.create('User', {d: new Date('2017/08/22')})

    equal(
      (await driver.list('User', {filter: {d: {$gt: new Date('2017/07/23')}}})).meta.length,
      1
    )
    equal(
      (await driver.list('User', {filter: {d: {$gt: new Date('2017/06/23')}}})).meta.length,
      2
    )
    equal(
      (await driver.list('User', {filter: {d: {$between: [new Date('2017/07/21'), new Date('2017/07/23')]}}})).meta.length,
      1
    )
  })

  it('A lot of CRUD on sqlite', async () => {
    const log = fs.createWriteStream(`${__dirname}/../tmp/a-lot-of-CRUD.log`)
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage09,
      dialect: 'sqlite',
      benchmark: true,
      // logging: (line) => log.write(line + EOL),
      logging: false
    })
    await driver.drop('Box')

    const NUMBER_OF_ENTITY = 50
    const NUMBER_OF_ATTRIBUTE = 10
    const ids = []

    // Create
    {
      const startAt = new Date()
      const creatingQueue = []
      for (let i = 0; i < NUMBER_OF_ENTITY; i++) {
        const attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
          .fill(null)
          .reduce((attr, _, j) => Object.assign(attr, {
            [`attr-${j}`]: `${j}-created`
          }), {index: i})
        creatingQueue.push(driver.create('Box', attributes))
      }
      ids.push(
        ...(await Promise.all(creatingQueue)).map(({id}) => id)
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
            [`attr-${j}`]: {name: `${j}-updated`}
          }), {})
        updateQueue.push(
          driver.update('Box', id, attributes)
        )
      }
      await Promise.all(updateQueue)
      console.log(`Took ${new Date() - startAt}ms for ${NUMBER_OF_ENTITY} entities, ${NUMBER_OF_ATTRIBUTE} attributes to update`)
    }
    asleep(100)
    await driver.close()

    asleep(100)
    log.end()
  })

  it('A lot of CRUD on mysql', async () => {
    async function resetMysqlDatabase (rootUsername, rootPassword, config = {}) {
      const escape = (value) => `${'\\`'}${value}${'\\`'}`
      let {username, password, database, host = 'localhost'} = config
      rootUsername = rootUsername || config.rootUsername || 'root'
      rootPassword = rootPassword || config.rootPassword
      let sql = `DROP DATABASE IF EXISTS ${database}; CREATE DATABASE IF NOT EXISTS ${database}; GRANT ALL ON ${escape(database)}.* TO '${username}'@'%' IDENTIFIED BY '${password}'`
      let command = `mysql -u${rootUsername} --host=${host} ${host === 'localhost' ? '' : '--protocol=tcp '}-e"${sql}"`
      let env = Object.assign({}, process.env)
      if (rootPassword) {
        env.MYSQL_PWD = rootPassword
      }
      let {stdout, stderr} = await new Promise((resolve, reject) =>
        exec(command, {env}, (err, stdout, stderr) =>
          err ? reject(err) : resolve({stdout, stderr})
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

    const driver = new SequelizeDriver(DATABASE, DB_ROOT_USER, DB_ROOT_PASSWORD, {
      dialect: 'mysql',
      benchmark: true,
      // logging: console.log
      logging: false
    })
    await driver.drop('Box')

    const NUMBER_OF_ENTITY = 100
    const NUMBER_OF_ATTRIBUTE = 20

    for (let n = 0; n < 2; n++) {
      const ids = []

      // Create
      {
        const startAt = new Date()
        const creatingQueue = []
        const indexes = new Array(NUMBER_OF_ENTITY).fill(null).map((_, i) => i)
        for (const i of indexes) {
          let attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
            .fill(null)
            .reduce((attr, _, j) => Object.assign(attr, {
              [`attr-${j}`]: j
            }), {index: i})
          creatingQueue.push(driver.create('Box', attributes))
        }
        ids.push(
          ...(await Promise.all(creatingQueue)).map(({id}) => id)
        )
        console.log(`Took ${new Date() - startAt}ms for ${NUMBER_OF_ENTITY} entities, ${NUMBER_OF_ATTRIBUTE} attributes to create`)
      }
      // Update
      {
        for (let i = 0; i < 2; i++) {
          const updateQueue = []
          const startAt = new Date()
          for (const id of ids) {
            const attributes = new Array(NUMBER_OF_ATTRIBUTE - 1)
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

      await driver.list('Box', {sort: [`attr-1`]})

      // large data
      {
        const created = await driver.create('Big', {
          name: 'd1',
          payload: new Array(1000).fill('a').join('')
        })
        equal(created.payload.length, 1000)

        for (const l of [0, 10, 2000]) {
          await driver.update('Big', created.id, {
            payload: new Array(l).fill('b').join('')
          })

          const one = await driver.one('Big', created.id)
          equal(one.payload.length, l)
        }
      }
    }
    await driver.close()

    // Apply usage
    {
      const driver = new SequelizeDriver(DATABASE, DB_ROOT_USER, DB_ROOT_PASSWORD, {
        dialect: 'mysql',
        benchmark: true,
        logging: console.log
        // logging: false
      })
      await driver.list('Box', {filter: {[`attr-1`]: 'attr-1-1'}})
      await driver.list('Box', {sort: [`attr-1`]})
    }
  })

  it('skip duplicate update', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage10,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    let entity = await driver.create('Color', {name: 'red', code: '#E11'})
    equal(entity.code, '#E11')
    await driver.update('Color', entity.id, {code: '#F11', name: 'red'})
    entity = await driver.one('Color', entity.id)
    equal(entity.code, '#F11')
  })

  it('Store large data', async () => {
    const driver = new SequelizeDriver('foo', '', '', {
      storage: storage11,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    const created = await driver.create('Big', {
      name: 'd1',
      payload: new Array(1000).fill('a').join('')
    })
    equal(created.payload.length, 1000)

    for (const l of [0, 10, 2000, 3, 500]) {
      const prefix = 'aaaa'
      const payload = prefix + new Array(l).fill('b').join('')
      await driver.update('Big', created.id, {
        payload
      })
      const one = await driver.one('Big', created.id)
      equal(one.payload.length, l + prefix.length)
      ok(/^aaaa/.test(one.payload))

      const list = await driver.list('Big', {filter: {payload}})
      equal(list.meta.total, 1)
    }
    await driver.destroy('Big', created.id)
  })

  it('Handling object and array', async () => {
    const driver = new SequelizeDriver('foo', '', '', {
      storage: storage11,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    const created = await driver.create('Big', {
      name: 'd1',
      values: {
        s1: 'string01',
        s2: 'string02',
        o1: {'k1': 'This is key01', 'k2': 'This is key02'},
        d1: new Date(),
        n1: 1,
        b1: true,
        a1: new Array(500).fill(null).map((_, i) => i)
      },
    })
    equal(created.values.o1.k1, 'This is key01')
    strictEqual(created.values.b1, true)
    equal(created.values.a1.length, 500)

    const updated = await driver.update('Big', created.id, {
      values: {n2: 2, b1: null, o1: {k3: 'This is key03'}}
    })

    deepEqual(updated.values.o1, {k3: 'This is key03'})
  })

  // https://github.com/realglobe-Inc/hec-eye/issues/216
  it('Multiple extra', async () => {
    const driver = new SequelizeDriver('foo', '', '', {
      storage: storage12,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })

    const poster01 = await driver.create('Poster', {
      attr01: new Array(200).fill('a').join('_'),
      attr02: new Array(200).fill('b').join('_'),
      attr03: {
        c: new Array(10).fill(null).map((_, i) => ({i})),
      }
    })

    const {entities, meta} = await driver.list('Poster')
    deepEqual({offset: 0, limit: 100, total: 1, length: 1}, meta)

    const updated = await driver.update('Poster', poster01.id, {
      attr03: {
        c: new Array(200).fill(null).map((_, i) => ({i})),
      }
    })
    equal(updated.attr03.c.length, 200)
  })

  // https://github.com/realglobe-Inc/claydb/issues/13
  it('Update many times', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage13,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })
    const entity = await driver.create('A', {number: -1})

    await Promise.all(
      new Array(10).fill(null).map((_, i) =>
        (async () => {
          const number = i
          console.log('Update number', number)
          const updated = await driver.update('A', entity.id, {number})
          console.log('Updated', updated.number)
        })()
      )
    )

  })

  // https://github.com/realglobe-Inc/claydb/issues/12
  it('Handle array', async () => {
    const driver = new SequelizeDriver('hoge', '', '', {
      storage: storage12,
      dialect: 'sqlite',
      benchmark: true,
      logging: false
    })
    const user01 = await driver.create('User', {strings: ['a', 'b']})
    const user02 = await driver.create('User', {})
    const user01Updated = await driver.update('User', user01.id, {strings: ['c']})

    deepEqual(user01.strings, ['a', 'b'])
    deepEqual(user02.strings, null)
    deepEqual(user01Updated.strings, ['c'])
  })
})

/* global describe, before, after, it */
