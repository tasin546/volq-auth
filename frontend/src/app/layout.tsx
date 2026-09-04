import '../styles/globals.css';
import React from 'react';
import { AuthProvider } from '../lib/authContext';

export const metadata = {
  title: 'VOLQ-AUTH | Zero-Cost Anti-Tamper Licensing Platform',
  description: 'Open-source, cryptographically hardened software licensing running on 100% free-tier cloud infrastructure.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian-void text-text-primary antialiased selection:bg-brand/30 selection:text-white min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
