import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TACT-IX',
  description: 'The private World Cup 2026 fantasy prediction platform for your circle.',
  keywords: 'FIFA World Cup 2026, fantasy football, prediction, friends',
  // Replace this with your actual production URL when deployed
  metadataBase: new URL('http://tact-11-jade.vercel.app'),
  openGraph: {
    title: 'TACT-IX',
    description: 'The private World Cup 2026 fantasy prediction platform for your circle.',
    type: 'website',
    siteName: 'TACT-IX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TACT-IX',
    description: 'The private World Cup 2026 fantasy prediction platform for your circle.',
  },
}

import { ThemeProvider } from '@/components/ThemeProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
