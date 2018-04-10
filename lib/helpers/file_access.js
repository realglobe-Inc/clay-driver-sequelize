'use strict'

const {readFileAsync, writeFileAsync} = require('asfs')
const path = require('path')
const amkdirp = require('amkdirp')
const rimraf = require('rimraf')

exports.clearDir = async (dirname) => {
  await new Promise((resolve, reject) => {
    rimraf(dirname, (e) => e ? reject(e) : resolve())
  })
}

exports.fromJSONFile = async (filename) => {
  const content = await readFileAsync(filename).catch(() => null)
  try {
    return content && JSON.parse(content)
  } catch (e) {
    return null
  }
}

exports.toJSONFile = async (filename, data) => {
  const content = JSON.stringify(data)
  await amkdirp(path.dirname(filename))
  await writeFileAsync(filename, content)
}
