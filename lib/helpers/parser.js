'use strict'

const {DataTypes} = require('clay-constants')
const {typeOf} = require('clay-serial')
const {clone} = require('asobj')
const {OBJECT, REF} = DataTypes
const {Op} = require('sequelize')
const {serialize} = require('./serializer')
const {unlessProduction} = require('asenv')
const logger = require('./logger')
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

function serializeFilterValue (value) {
  if (Array.isArray(value)) {
    return value.map((v) => serializeFilterValue(v))
  }
  if (typeOf(value) === OBJECT) {
    // TODO Parse nested?
    return value
  }
  return serialize(value)
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
      unlessProduction(() => logger.warn(`You can not filter with field "${name}"`))
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
              parsed[colName][operator] = serializeFilterValue(subValue)
            } else {
              if (attributes.length > 0) {
                logger.warn(`Unknown filter "${name}" for ${modelName}`)
              }
              parsed.id = INVALID_FILTER_CONDITION_ID
            }
          } else {
            logger.warn(`Passing nested filter is not supported: "${name}.${subName}"`)
            if (subName === 'id') {
              logger.warn('If you want to filter by entity, use ref string instead of id (eg. `filter:{user: {$ref: "User#01"}}`)')
            }
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
            logger.warn(`Filter value for "${name}" is too long. (Should be shorter than ${valueBaseLength})`)
            parsed[colName] = serializedValue.slice(0, valueBaseLength)
          } else {
            parsed[colName] = serializedValue
          }
        } else {
          logger.warn(`Unknown filter "${name}" for ${modelName}`)
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
