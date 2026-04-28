import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://blocksworm.com'),
  title: {
    default: 'Blocksworm — Block Puzzle RPG · Clear Lines, Summon Legends',
    template: '%s · Blocksworm',
  },
  description:
    'Lead a squad of legendary heroes into elemental battles. Clear lines, trigger ultimates, climb the Tower. Free-to-play block puzzle RPG with Marvel Snap-style depth.',
  keywords: [
    'block puzzle RPG',
    'free puzzle game',
    'elemental heroes',
    'Marvel Snap alternative',
    'block puzzle',
    'tower defense puzzle',
    'browser game',
    'mobile RPG',
  ],
  authors: [{ name: 'Blocksworm Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://blocksworm.com',
    siteName: 'Blocksworm',
    title: 'Blocksworm — Block Puzzle RPG',
    description:
      'Clear lines, summon legends. 25 heroes across 5 races, 5 chapters, endless Tower mode.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Blocksworm — Block Puzzle RPG',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blocksworm — Block Puzzle RPG',
    description: 'Clear lines, summon legends. Free to play.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0A0A1A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-dark text-text-primary min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
