import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Rhythm Game Generator',
  description: 'Turn your music into an interactive rhythm game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Background layers */}
        <div className="fixed inset-0" style={{ background: 'linear-gradient(135deg, #000000 0%, #0f3828 50%, #239063 100%)' }} />
        <div className="fixed inset-0 grid-bg" />
        
        {/* Glow effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="green-glow top-20 left-1/4" />
          <div className="green-glow bottom-20 right-1/4" />
        </div>

        {/* Content */}
        <main className="relative">
          {children}
        </main>
      </body>
    </html>
  )
}
