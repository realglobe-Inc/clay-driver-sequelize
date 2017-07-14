/**
 * SQL Builder
 * @module builder
 */
'use strict'

const { EOL } = require('os')

const as = (prefix, name) => [ prefix, name ].join('X')
  .replace(/\$/g, '_')
  .replace(/\./g, '_')
const sortAs = (name) => as('sorting', name)
const filterAs = (name) => as('filtering', name)
const sortAbs = (name) => name.replace(/^-/, '')

function buildWhereTerm ({ QueryGenerator, filter }) {
  const filterKeys = Object.keys(filter || {})
  return filterKeys.map((name) => {
    return QueryGenerator.whereItemQuery('value', filter[ name ], { prefix: filterAs(name) })
  }).filter(Boolean).map((v) => v.trim()).join(' AND ')
}

function buildOrderTerm ({ sort }) {
  return sort.map((name) => {
    return `\`${sortAs(sortAbs(name))}\`.value ${/^-/.test(name) ? 'DESC' : 'ASC'}`
  }).filter(Boolean).join(', ')
}

function buildSelectSQL ({ filter, sort, limit, offset, orderTerm, whereTerm }) {
  const filterKeys = Object.keys(filter || {})
  return `
SELECT
  \`Entity\`.id as id 
FROM \`Entities\` AS \`Entity\`
${filterKeys.map((name) => `
INNER JOIN \`EntityAttributes\` AS \`${filterAs(name)}\`
  ON \`Entity\`.\`id\` = \`${filterAs(name)}\`.\`EntityId\` AND \`${filterAs(name)}\`.\`name\` = '${name}'
`).join(' ')}
${sort.map((name) => `
LEFT OUTER JOIN \`EntityAttributes\` AS \`${sortAs(sortAbs(name))}\`
  ON \`Entity\`.\`id\` = \`${sortAs(sortAbs(name))}\`.\`EntityId\` AND \`${sortAs(sortAbs(name))}\`.\`name\` = '${sortAbs(name)}'
`).join(' ')}
WHERE \`Entity\`.\`ResourceId\` = :ResourceId 
${whereTerm ? `AND ${whereTerm.trim()}` : ''}    
${orderTerm ? `ORDER BY ${orderTerm.trim()}` : `ORDER BY \`Entity\`.createdAt`}
${limit ? `LIMIT ${limit}` : ''}
${offset ? `OFFSET ${offset}` : ''}
          `.split(EOL).join(' ').trim()
}

/**
 * @function buildCountSQL
 * @returns {string}
 */
function buildCountSQL ({ filter, whereTerm }) {
  const filterKeys = Object.keys(filter || {})
  return `
SELECT 
  count(DISTINCT(\`Entity\`.\`id\`)) AS \`count\`
FROM \`Entities\` AS \`Entity\`
${filterKeys.map((name) => `
    INNER JOIN \`EntityAttributes\` AS \`${filterAs(name)}\`
      ON \`Entity\`.\`id\` = \`${filterAs(name)}\`.\`EntityId\` AND \`${filterAs(name)}\`.\`name\` = '${name}'
    `).join(' ')}
WHERE \`Entity\`.\`ResourceId\` = :ResourceId
${whereTerm ? `AND ${whereTerm}` : ''}    
          `.split(EOL).join(' ').trim()
}

module.exports = {
  buildWhereTerm,
  buildOrderTerm,
  buildSelectSQL,
  buildCountSQL
}
