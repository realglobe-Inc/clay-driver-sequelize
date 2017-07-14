'use strict'

const { DataTypes } = require('clay-constants')
const { typeOf, withType } = require('clay-serial')
const { NUMBER, DATE } = DataTypes

const padLeft = (value, digit, padding = '0') => new Array(digit - String(value).length + 1).join(padding || '0') + value

exports.serialize = (value, type = typeOf(value)) => {
  switch (type) {
    case DATE: {
      return String(new Date(value).getTime())
    }
    case NUMBER: {
      const MAX_NUMBER_DIGIT = 24
      if (String(value).length > MAX_NUMBER_DIGIT) {
        throw new Error(`[ClayDriverSequelize] Too large number: ${value}`)
      }
      // TODO $gt/$ltのためにゼロ詰めした文字列にしているけど非効率なので他の手段を考える
      return padLeft(value, MAX_NUMBER_DIGIT)
    }
    default: {
      return String(value)
    }
  }
}

exports.deserialize = (value, type) => {
  switch (type) {
    case DATE: {
      value = Number(value)
      break
    }
    default: {
      break
    }
  }
  return withType(value, type)
}
