import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import './globals.css';
import { Inter } from 'next/font/google';
import { ClientLayout } from '@/components/ClientLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MP3 to MIDI Converter',
  description: 'Convert your MP3 files to MIDI tracks for rhythm games',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
