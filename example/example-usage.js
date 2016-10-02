'use strict'

const { SequelizeDriver } = require('clay-driver-memory')

{
  const clayLump = require('clay-lump')
  let lump01 = clayLump({
    driver: new SequelizeDriver({

    })
  })
  /* ... */
}
