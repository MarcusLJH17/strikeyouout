import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://strikeyouout.com'),
  title: 'Strike You Out — Daily Pitching Challenge',
  description: 'Call your pitch, hit your spot, and try to strike out today’s hitter.',
  openGraph: {
    title: 'Strike You Out — Daily Pitching Challenge',
    description: 'Can you strike out today’s hitter?',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Strike You Out daily pitching challenge' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strike You Out — Daily Pitching Challenge',
    description: 'Can you strike out today’s hitter?',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
