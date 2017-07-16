/**
 * Modeling functions
 * @module modelings
 */

'use strict'

let d = (module) => module && module.default || module

module.exports = {
  get attributeModel () { return d(require('./attribute_model')) },
  get entityModel () { return d(require('./entity_model')) },
  get resourceModel () { return d(require('./resource_model')) }
}
