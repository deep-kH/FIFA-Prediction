import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CupHub Fantasy Engine',
  description: 'The private World Cup 2026 fantasy prediction platform for your circle.',
  keywords: 'FIFA World Cup 2026, fantasy football, prediction, friends',
  openGraph: {
    title: 'CupHub Fantasy Engine',
    description: 'The private World Cup 2026 fantasy prediction platform for your circle.',
    type: 'website',
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
