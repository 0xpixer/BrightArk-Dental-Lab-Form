import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/admin/login',
  },
  providers: [],
  trustHost: true,
} satisfies NextAuthConfig
