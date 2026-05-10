// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

const path = require('path')
const fs = require('fs')
const { Client } = require('pg')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

async function run() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL not set. Copy .env.example to .env and fill in your Neon connection string.')
    process.exit(1)
  }

  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  console.log('Connected to database')

  const migrationsDir = __dirname
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`Running ${file}...`)
    await client.query(sql)
    console.log(`  done`)
  }

  await client.end()
  console.log('All migrations complete')
}

run().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
