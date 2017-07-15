'use strict'

const { DataTypes } = require('clay-constants')
const { typeOf } = require('clay-serial')
const { OBJECT, REF } = DataTypes
const { serialize } = require('./serializer')
const { unlessProduction } = require('asenv')

exports.parseFilter = (filter) => {
  if (!filter) {
    return filter
  }
  const parsed = {}
  for (const name of Object.keys(filter)) {

    if (/^\$\$/.test(name)) {
      unlessProduction(() => console.warn(`You can not filter with field "${name}"`))
      continue
    }
    const value = filter[ name ]
    const type = typeOf(value)
    switch (type) {
      case REF: {
        parsed[ `${name}.$ref` ] = value.$ref
        break
      }
      case OBJECT: {
        const subNames = Object.keys(value)
        for (const subName of subNames) {
          const subValue = value[ subName ]
          const isOperator = /^\$/.test(subName)
          if (isOperator) {
            parsed[ name ] = parsed[ name ] || {}
            parsed[ name ][ subName ] = Array.isArray(subValue) ? subValue.map((v) => serialize(v)) : serialize(subValue)
          } else {
            parsed[ `${name}.${subName}` ] = serialize(subValue)
          }
        }
        break
      }
      default: {
        parsed[ name ] = serialize(value)
        break
      }
    }
  }
  return parsed
}
