'use strict'

const {DataTypes} = require('clay-constants')
const {typeOf} = require('clay-serial')
const {clone} = require('asobj')
const {OBJECT, REF} = DataTypes
const {serialize} = require('./serializer')
const {unlessProduction} = require('asenv')

const SORT_DEST_PREFIX = /^-/
const toColNamesFor = (attributes) => {
  const colNames = Object.assign(
    {},
    ...attributes.map(({name, col}) => ({[name]: `v${col}`}))
  )
  return (name) => {
    switch (name) {
      case 'id': {
        return 'cid'
      }
      case '$$num': {
        return 'id'
      }
      default: {
        return colNames[name]
      }
    }

  }
}

function parseFilter (filter, options = []) {
  if (!filter) {
    return filter
  }
  if (Array.isArray(filter)) {
    return {$or: filter.map((filter) => parseFilter(filter, options))}
  }

  const {$or} = filter
  if ($or) {
    const or = parseFilter($or, options)
    const otherFilter = clone(filter, {without: ['$or']})
    return Object.assign(or, parseFilter(otherFilter, options))
  }

  const {attributes = []} = options
  const parsed = {}
  const colNameFor = toColNamesFor(attributes)

  for (const name of Object.keys(filter)) {
    const isMeta = /^\$\$/.test(name) && (name !== '$$num')
    if (isMeta) {
      unlessProduction(() => console.warn(`You can not filter with field "${name}"`))
      continue
    }
    const value = filter[name]
    const type = typeOf(value)
    switch (type) {
      case REF: {
        const colName = colNameFor(`${name}.$ref`)
        if (colName) {
          parsed[colName] = value.$ref
        }
        break
      }
      case OBJECT: {
        const subNames = Object.keys(value)
        for (const subName of subNames) {
          const subValue = value[subName]
          const isOperator = /^\$/.test(subName)
          if (isOperator) {
            const colName = colNameFor(name)
            if (colName) {
              parsed[colName] = parsed[colName] || {}
              parsed[colName][subName] = Array.isArray(subValue) ? subValue.map((v) => serialize(v)) : serialize(subValue)
            }
          } else {
            const colName = colNameFor(`${name}.${subName}`)
            if (colName) {
              parsed[colName] = serialize(subValue)
            }
          }
        }
        break
      }
      default: {
        const colName = colNameFor(name)
        if (colName) {
          parsed[colName] = serialize(value)
        }
        break
      }
    }
  }
  return parsed
}

function parseSort (sort, {attributes} = {}) {
  const colNameFor = toColNamesFor(attributes)
  return [].concat(sort)
    .filter(Boolean)
    .reduce((names, name) => names.concat(name.split(',')), [])
    .filter(Boolean)
    .map((name) => {
      const isDesc = SORT_DEST_PREFIX.test(name)
      const colName = colNameFor(name.replace(SORT_DEST_PREFIX, ''))
      if (!colName) {
        return null
      }
      return [colName, isDesc ? 'DESC' : 'ASC']
    })
    .filter(Boolean)
}

module.exports = {
  parseFilter,
  parseSort
}
