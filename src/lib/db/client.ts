import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type Db = NeonHttpDatabase<typeof schema>

let _db: Db | undefined

export function getDb(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    const sql = neon(url)
    _db = drizzle(sql, { schema })
  }
  return _db
}
