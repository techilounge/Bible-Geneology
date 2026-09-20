import type { Metadata, Viewport } from 'next';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ServiceWorker } from '@/components/layout/ServiceWorker';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SkipLink } from '@/components/ui/SkipLink';
import { branding } from '@/lib/config/branding';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: branding.productName,
    template: `%s · ${branding.productName}`,
  },
  description: branding.description,
  metadataBase: new URL(branding.siteUrl),
  applicationName: branding.productName,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: branding.shortName },
  // Without this the browser asks for /favicon.ico on every page load and
  // gets a 404. The icons already exist for the manifest; pointing at them
  // costs nothing and stops the noise.
  icons: {
    icon: [{ url: '/icon-192.png', type: 'image/png', sizes: '192x192' }],
    apple: [{ url: '/icon-192.png', sizes: '192x192' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#12161c',
  // Zooming is never disabled. Requirement section 50, and the reason it is
  // a requirement: a reader who needs to zoom cannot opt back in.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col antialiased">
        <SkipLink />
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
        <ServiceWorker />
      </body>
    </html>
  );
}
