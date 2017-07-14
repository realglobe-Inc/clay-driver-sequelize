'use strict'

const { DataTypes } = require('clay-constants')
const { typeOf } = require('clay-serial')
const { OBJECT, REF } = DataTypes
const { serialize } = require('./serializer')

exports.parseFilter = (filter) => {
  if (!filter) {
    return filter
  }
  let parsed = {}
  for (let name of Object.keys(filter)) {
    let value = filter[ name ]
    let type = typeOf(value)
    switch (type) {
      case REF: {
        parsed[ `${name}.$ref` ] = value.$ref
        break
      }
      case OBJECT: {
        let subNames = Object.keys(value)
        for (let subName of subNames) {
          let subValue = value[ subName ]
          let isOperator = /^\$/.test(subName)
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
