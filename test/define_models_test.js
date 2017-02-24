/**
 * Test case for defineModels.
 * Runs with mocha.
 */
'use strict'

const defineModels = require('../lib/modeling/define_models.js')
const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const Sequelize = require('sequelize')
const co = require('co')

describe('define-models', function () {
  this.timeout(3000)
  let db
  let storage = `${__dirname}/../tmp/testing-model.db`

  before(() => co(function * () {
    mkdirp.sync(path.dirname(storage))
    db = new Sequelize('models', '', '', {
      storage,
      dialect: 'sqlite'
    })

    db.models = defineModels(db)

    yield db.drop()
    yield db.sync({ force: true })
  }))

  after(() => co(function * () {
  }))

  it('Define models', () => co(function * () {
    const { Resource } = db.models
    let fooResource01 = yield Resource.ofName('foo')
    assert.equal(fooResource01.name, 'foo')
    let fooResource02 = yield Resource.ofName('foo')
    assert.equal(fooResource02.name, 'foo')
    assert.equal(fooResource01.id, fooResource02.id)
  }))
})

/* global describe, before, after, it */
