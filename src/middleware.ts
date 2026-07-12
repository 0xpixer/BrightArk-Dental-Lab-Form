import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname === '/admin') {
    return NextResponse.redirect(new URL(req.auth?.user?.role === 'doctor' || req.auth?.user?.role === 'clinic_staff' ? '/portal/orders' : '/admin/submissions', req.url))
  }

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/share/')) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith('/portal') && !['doctor', 'clinic_staff'].includes(req.auth.user?.role ?? '')) {
    return NextResponse.redirect(new URL('/admin/submissions', req.url))
  }

  if (pathname.startsWith('/admin') && ['doctor', 'clinic_staff'].includes(req.auth.user?.role ?? '')) {
    return NextResponse.redirect(new URL('/portal/orders', req.url))
  }

  if (
    pathname.startsWith('/admin/accounts') &&
    req.auth.user?.role !== 'superadmin'
  ) {
    return NextResponse.redirect(new URL('/admin/submissions', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*'],
}
