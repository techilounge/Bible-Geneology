import type { Metadata } from 'next';
import { branding } from '@/lib/config/branding';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: branding.productName,
    template: `%s · ${branding.productName}`,
  },
  description: branding.description,
  metadataBase: new URL(branding.siteUrl),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
