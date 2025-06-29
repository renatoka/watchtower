import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Navigation } from './components/Navigation'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
})

export const metadata: Metadata = {
    title: 'Watchtower',
    description:
        'Watchtower is a real-time monitoring dashboard for uptime checks and system status updates. Built with Next.js and WebSockets, it provides live insights, historical uptime statistics, and alert messaging—all in one minimalist interface.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <Navigation />
                {children}
            </body>
        </html>
    )
}
