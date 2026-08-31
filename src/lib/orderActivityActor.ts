import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'

export async function getOrderActivityActorName(userId: number, fallback: string): Promise<string> {
  const [account] = await getDb()
    .select({ fullName: adminUsers.fullName, username: adminUsers.username })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1)

  return account?.fullName?.trim() || account?.username || fallback
}
