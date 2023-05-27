import { Inter } from 'next/font/google';
import { RootProviders } from '@/context/core';
import './globals.scss';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Whisper to me',
  description: 'Transcribe your speech in real-time',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
