/**
 * Modeling functions
 * @module modelings
 */

'use strict'

const _d = (module) => module && module.default || module

const attributeModel = _d(require('./attribute_model'))
const entityModel = _d(require('./entity_model'))
const lockModel = _d(require('./lock_model'))
const resourceModel = _d(require('./resource_model'))
const usageModel = _d(require('./usage_model'))

module.exports = {
  attributeModel,
  entityModel,
  lockModel,
  resourceModel,
  usageModel
}
