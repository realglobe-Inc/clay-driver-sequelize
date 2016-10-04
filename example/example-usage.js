'use strict'

const { SequelizeDriver } = require('clay-driver-sequelize')

{
  const clayLump = require('clay-lump')
  let lump01 = clayLump({
    driver: new SequelizeDriver({})
  })
  /* ... */
}
