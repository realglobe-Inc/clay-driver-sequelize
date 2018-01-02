/**
 * Define lock model
 * @function lockModel
 * @returns {Object} Defined model
 */
'use strict'

const {STRING, BOOLEAN} = require('sequelize')
const asleep = require('asleep')

/** @lends lockModel */
function lockModel ({
                      db
                    }) {
  const Lock = db.define('Lock', {
    name: {
      comment: 'Name of lock',
      type: STRING,
      allowNull: false,
      unique: true
    },
    active: {
      comment: 'Is resource locked',
      type: BOOLEAN,
      default: false
    }
  }, {
    classMethods: {

      async waitToLock (name, options = {}) {
        const {tryMax = 5, tryInterval = 300} = options
        for (let i = 0; i < tryMax; i++) {
          const isLocked = await Lock.isLocked(name)
          if (!isLocked) {
            return true
          }
          await asleep(tryInterval)
        }
        throw new Error(`[ClaryDriverSequelize] Locked: ${name}`)
      },

      async isLocked (name) {
        const lock = await Lock.findOne({
          where: {name}
        }).catch(() => null)
        return lock && lock.active
      },

      async lockWhile (name, action) {
        const [lock] = await Lock.findOrCreate({
          where: {name},
          defaults: {name, active: true}
        })
        if (!lock.active) {
          await lock.update({active: true})
        }
        try {
          await action()
        } finally {
          await lock.update({active: false})
        }
      },

      async unlockAll () {
        const locks = await Lock.findAll({
          where: {active: true}
        })
        for (const lock of locks) {
          await lock.update({active: false})
        }
      }
    }
  })

  return Lock
}

module.exports = lockModel
