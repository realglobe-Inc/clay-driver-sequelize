/**
 * Modeling functions
 * @module modelings
 */

'use strict'

let d = (module) => module && module.default || module

module.exports = {
  get builder () { return d(require('./builder')) },
  get defineModels () { return d(require('./define_models')) },
  get normalizer () { return d(require('./normalizer')) },
  get parser () { return d(require('./parser')) },
  get serializer () { return d(require('./serializer')) }
}
