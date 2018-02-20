/**
 * Modeling functions
 * @module modelings
 */

'use strict'

const d = (module) => module && module.default || module

const attributeModel = d(require('./attribute_model'))
const entityModel = d(require('./entity_model'))
const lockModel = d(require('./lock_model'))
const resourceModel = d(require('./resource_model'))
const usageModel = d(require('./usage_model'))

module.exports = {
  attributeModel,
  entityModel,
  lockModel,
  resourceModel,
  usageModel
}
