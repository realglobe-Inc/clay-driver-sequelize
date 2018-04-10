/**
 * Define lock model
 * @function lockModel
 * @returns {Object} Defined model
 */
'use strict'

const {STRING, BOOLEAN} = require('sequelize')
const path = require('path')
const {fromJSONFile, toJSONFile, clearDir} = require('../helpers/file_access')

const asleep = require('asleep')

/** @lends lockModel */
function lockModel ({
                      db,
                      varDir,
                    }) {
  // TODO Save lock data into file system
  const lockDirName = path.join(varDir, 'locks')
  const lockFileNameFor = (name) => path.join(lockDirName, `lock-${name}.json`)

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
        const filename = lockFileNameFor(name)
        const lock = await fromJSONFile(filename) || {}
        return lock && lock.active
      },

      async lockWhile (name, action) {
        const filename = lockFileNameFor(name)
        await toJSONFile(filename, {active: true})
        try {
          await action()
        } finally {
          await toJSONFile(filename, {active: false})
        }
      },

      async unlockAll () {
        await clearDir(lockDirName)
      }
    }
  })

  return Lock
}

module.exports = lockModel
