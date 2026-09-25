import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname === '/admin') {
    return NextResponse.redirect(new URL('/admin/overview', req.url))
  }

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/share/')) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Server layouts and API guards resolve current roles from the database.
  // Edge middleware only checks whether a signed session cookie is present.
  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*'],
}
