// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const crypto = require('crypto')

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

let _key = null
function getKey() {
  if (_key) return _key
  const hex = process.env.PARALLAX_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  _key = Buffer.from(hex, 'hex')
  return _key
}

function encrypt(plaintext) {
  if (!plaintext) return ''
  const key = getKey()
  if (!key) return plaintext
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'enc:' + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decrypt(data) {
  if (!data) return ''
  if (!data.startsWith('enc:')) return data
  const key = getKey()
  if (!key) return data
  const buf = Buffer.from(data.slice(4), 'base64')
  if (buf.length < IV_LEN + TAG_LEN) return data
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const encrypted = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8')
}

module.exports = { encrypt, decrypt }
