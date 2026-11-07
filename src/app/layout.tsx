import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/playfair-display'
import './globals.css'

export const metadata: Metadata = {
  title: 'QSCHOOL',
  description: 'QSCHOOL — plateforme de gestion scolaire',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QSCHOOL',
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
