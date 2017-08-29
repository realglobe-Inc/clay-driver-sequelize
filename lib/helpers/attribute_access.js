/**
 * Access for attribute
 * @module attributeAccess
 */
'use strict'

const ARRAY_INDEX_PATTERN = /\[[0-9+]\]/g

let indexesOf = (name) => {
  const matched = name.match(ARRAY_INDEX_PATTERN)
  return matched && matched.map((hit) => Number(hit.replace(/^\[/, '').replace(/\]$/, '')))
}

module.exports = Object.assign(exports, {
  get (attributes, name) {
    let indexes = indexesOf(name)
    if (indexes) {
      let indexed = attributes[name.replace(ARRAY_INDEX_PATTERN, '')]
      for (const index of indexes) {
        indexed = (indexed || [])[index]
      }
      return indexed
    } else {
      return attributes[name]
    }
  },
  set (attributes, name, val) {
    const indexes = indexesOf(name)
    if (indexes) {
      const nameWithoutIndex = name.replace(ARRAY_INDEX_PATTERN, '')
      attributes[nameWithoutIndex] = attributes[nameWithoutIndex] || []
      let array = attributes[nameWithoutIndex]
      for (const arrayIndex of indexes.slice(0, -1)) {
        array[arrayIndex] = array[arrayIndex] || []
        array = array[arrayIndex]
      }
      array[indexes[indexes.length - 1]] = val
    } else {
      attributes[name] = val
    }
  }
})
