'use strict'

const {DataTypes} = require('clay-constants')
const {typeOf} = require('clay-serial')
const {clone} = require('asobj')
const {OBJECT, REF} = DataTypes
const {Op} = require('sequelize')
const {serialize} = require('./serializer')
const {unlessProduction} = require('asenv')

const filteralabeMetaNames = ['$$num', '$$at']

const INVALID_FILTER_CONDITION_ID = '____clayInvalidFilterConditionID'

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
      case '$$at': {
        return 'updatedAt'
      }
      default: {
        return colNames[name]
      }
    }
  }
}

function parseFilter (filter, options = {}) {
  if (!filter) {
    return filter
  }
  if (Array.isArray(filter)) {
    return {[Op.or]: filter.map((filter) => parseFilter(filter, options))}
  }

  const {$or} = filter
  if ($or) {
    const or = parseFilter([].concat($or), options)
    const otherFilter = clone(filter, {without: ['$or']})
    return Object.assign(or, parseFilter(otherFilter, options))
  }

  const {attributes = [], valueBaseLength = null, modelName} = options
  const parsed = {}
  const colNameFor = toColNamesFor(attributes)

  for (const name of Object.keys(filter)) {
    const isMeta = /^\$\$/.test(name) && !filteralabeMetaNames.includes(name)
    if (isMeta) {
      unlessProduction(() => console.warn(`You can not filter with field "${name}"`))
      continue
    }
    const value = Array.isArray(filter[name]) ? {$or: filter[name]} : filter[name]
    const type = typeOf(value)
    switch (type) {
      case OBJECT: {
        const subNames = Object.keys(value)
        for (const subName of subNames) {
          const subValue = value[subName]
          const isOperator = /^\$/.test(subName)
          if (isOperator) {
            const operator = Op && Op.Aliases[subName] || subName
            const colName = colNameFor(name)
            if (colName) {
              parsed[colName] = parsed[colName] || {}
              parsed[colName][operator] = Array.isArray(subValue) ? subValue.map((v) => serialize(v)) : serialize(subValue)
            } else {
              console.warn(`[ClaryDriverSequelize] Unknown filter "${name}" for ${modelName}`)
              parsed.id = INVALID_FILTER_CONDITION_ID
            }
          } else {
            console.warn(`Passing nested filter is not supported: "${name}.${subName}")`)
          }
        }
        break
      }
      default: {
        const colName = colNameFor(name)
        if (colName) {
          const serializedValue = serialize(value)
          const tooLong = valueBaseLength && (valueBaseLength < serializedValue.length)
          if (tooLong) {
            console.warn(`[ClayDriverSequelize] Filter value for "${name}" is too long. (Should be shorter than ${valueBaseLength})`)
            parsed[colName] = serializedValue.slice(0, valueBaseLength)
          } else {
            parsed[colName] = serializedValue
          }
        } else {
          console.warn(`[ClaryDriverSequelize] Unknown filter "${name}" for ${modelName}`)
          parsed.id = INVALID_FILTER_CONDITION_ID
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
