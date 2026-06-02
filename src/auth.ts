import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'
import { checkLoginRateLimit, clearLoginRateLimit } from '@/lib/admin/rateLimit'
import { authConfig } from './auth.config'

declare module 'next-auth' {
  interface User {
    id: string
    username: string
    role: string
  }

  interface Session {
    user: User & {
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    username: string
    role: string
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined

        if (!username || !password) return null

        const { allowed } = checkLoginRateLimit(username)
        if (!allowed) return null

        const db = getDb()
        const [user] = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.username, username))
          .limit(1)

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        clearLoginRateLimit(username)

        await db
          .update(adminUsers)
          .set({ lastLoginAt: new Date() })
          .where(eq(adminUsers.id, user.id))

        return {
          id: String(user.id),
          username: user.username,
          role: user.role,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
})
