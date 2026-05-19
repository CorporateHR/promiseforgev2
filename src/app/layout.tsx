import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'Promiseforge — Organization',
  description: 'Manage your organization hierarchy',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} h-full`}>
      <body className="font-[family-name:var(--font-outfit)] min-h-full antialiased">
        {children}
      </body>
    </html>
  )
}
