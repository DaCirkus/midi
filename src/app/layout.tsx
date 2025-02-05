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
      <body className="min-h-screen bg-[#0A0118] text-white">
        {/* Animated gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-[#0A0118] via-[#1A0B2E] to-[#2A0B4E] animate-gradient-slow" />
        
        {/* Grid overlay */}
        <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center opacity-20" />
        
        {/* Glow effects */}
        <div className="fixed inset-0">
          <div className="absolute -inset-[10px] bg-[#6F2DC9] blur-[100px] opacity-20 animate-pulse-slow" />
          <div className="absolute -inset-[10px] bg-[#2A0B4E] blur-[60px] opacity-30" />
        </div>
        
        {/* Content */}
        <main className="relative">
          {children}
        </main>
      </body>
    </html>
  )
}
