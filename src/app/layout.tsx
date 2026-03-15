
import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Like Vision - Gestion Optique Professionnelle',
  description: 'Système complet de gestion et de facturation pour magasins d\'optique.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <body className="font-body antialiased" suppressHydrationWarning>
        <FirebaseClientProvider>
          <FirebaseErrorListener />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
