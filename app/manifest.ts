import type { MetadataRoute } from 'next';
import { branding } from '@/lib/config/branding';

/**
 * Generated rather than a static file, so the product name lives in exactly
 * one place (requirement section 1: renaming must not mean a refactor).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.productName,
    short_name: branding.shortName,
    description: branding.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#12161c',
    theme_color: '#12161c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
