// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')
const fs = require('fs')
const path = require('path')

let client = null
let bucket = null

function isR2Enabled() {
  return process.env.PARALLAX_STORAGE === 'r2' &&
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY &&
    process.env.R2_SECRET_KEY
}

function getClient() {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY,
      },
    })
    bucket = process.env.R2_BUCKET || 'parallax-uploads'
  }
  return client
}

async function uploadToR2(localFilePath, storageKey, contentType) {
  const s3 = getClient()
  const fileStream = fs.createReadStream(localFilePath)
  const stat = fs.statSync(localFilePath)

  // Use multipart upload for files > 50MB
  if (stat.size > 50 * 1024 * 1024) {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: storageKey,
        Body: fileStream,
        ContentType: contentType || 'application/octet-stream',
      },
      partSize: 10 * 1024 * 1024,
    })
    await upload.done()
  } else {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: fs.readFileSync(localFilePath),
      ContentType: contentType || 'application/octet-stream',
    }))
  }

  return { storageKey, size: stat.size }
}

async function streamFromR2(storageKey) {
  const s3 = getClient()
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }))
  return {
    body: res.Body,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  }
}

async function deleteFromR2(storageKey) {
  const s3 = getClient()
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }))
}

async function putBufferToR2(storageKey, buffer, contentType) {
  const s3 = getClient()
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }))
  return { storageKey, size: buffer.length }
}

module.exports = { isR2Enabled, uploadToR2, streamFromR2, deleteFromR2, putBufferToR2 }
