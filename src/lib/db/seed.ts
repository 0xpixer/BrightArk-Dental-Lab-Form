import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { adminUsers } from './schema'

const SUPERADMIN_USERNAME = 'arrow7440'
const SUPERADMIN_PASSWORD = 'Tintin16218172$$'

async function seed() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = neon(url)
  const db = drizzle(sql)

  const existing = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, SUPERADMIN_USERNAME))
    .limit(1)

  if (existing.length > 0) {
    console.log(`Superadmin "${SUPERADMIN_USERNAME}" already exists — skipping seed.`)
    return
  }

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12)

  await db.insert(adminUsers).values({
    username: SUPERADMIN_USERNAME,
    passwordHash,
    role: 'superadmin',
    isActive: true,
  })

  console.log(`Created superadmin account: ${SUPERADMIN_USERNAME}`)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
