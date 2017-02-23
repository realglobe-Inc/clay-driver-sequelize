/**
 * Modeling functions
 * @module modelings
 */

'use strict'

let d = (module) => module && module.default || module

module.exports = {
  get defineModels () { return d(require('./define_models')) }
}
