/**
 * Test case for create.
 * Runs with mocha.
 */
'use strict'

const create = require('../lib/create.js')
const assert = require('assert')


describe('create', function () {
  this.timeout(3000)

  before(async () => {

  })

  after(async () => {

  })

  it('Create', async () => {
    let created = create('', '', '', {
      dialect: 'sqlite'
    })
    assert.ok(created)
  })
})

/* global describe, before, after, it */
