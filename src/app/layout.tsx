import type { Metadata } from 'next'
import { Noto_Sans } from 'next/font/google'
import './globals.css'

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
})

export const metadata: Metadata = {
  title: 'BrightArk - Order Portal',
  description: 'Manage dental lab and clear aligner orders with BrightArk',
  icons: {
    icon: '/BrightArk icon.PNG',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${notoSans.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
