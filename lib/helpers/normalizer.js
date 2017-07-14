/**
 * Data normalizer
 * @module normalizer
 */
'use strict'

const { typeOf } = require('clay-serial')
const { DataTypes } = require('clay-constants')
const { OBJECT, REF } = DataTypes

/**
 * @function normalizeAttributeValues
 * @param {string} name
 * @param {*} value
 * @returns {Object}
 */
function normalizeAttributeValues (name, value) {
  if (Array.isArray(value)) {
    return value.reduce((attributeValues, entryValue, i) =>
        Object.assign(
          attributeValues,
          normalizeAttributeValues([ `${name}[${i}]` ], entryValue)
        ),
      {})
  }
  const attributeValues = {}
  let type = typeOf(value)
  switch (type) {
    case REF:
    case OBJECT: {
      Object.assign(attributeValues,
        ...Object.keys(value).map((subKey) => ({
          [`${name}.${subKey}`]: value[ subKey ]
        }))
      )
      break
    }
    default: {
      Object.assign(attributeValues, { [name]: value })
      break
    }
  }
  return attributeValues
}

/**
 * @function normalizeSort
 * @param sort
 * @returns {string[]}
 */
function normalizeSort (sort) {
  return [].concat(sort)
    .filter(Boolean)
    .reduce((names, name) => names.concat(name.split(',')), [])
    .filter(Boolean)
}

module.exports = {
  normalizeAttributeValues,
  normalizeSort
}
