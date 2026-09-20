import { ImageResponse } from 'next/og';
import { getDiscoveries, getDiscovery } from '@/lib/services/dataset';

/**
 * The shareable card (requirement section 36).
 *
 * 1200 by 630 is the ratio every one of the named platforms accepts and
 * crops sensibly, so there is one card rather than five. The headline on it
 * is the generated one, unchanged: a card that reworded the finding to fit
 * would be a hand-written claim in an image, which is the one thing the
 * discovery engine exists to prevent.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A finding from Bible Timeline Explorer';

export function generateStaticParams() {
  return getDiscoveries().map((discovery) => ({ id: discovery.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const discovery = getDiscovery((await params).id);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#12141a',
          color: '#f4f4f5',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 6, color: '#d6a85a' }}>
          DID YOU KNOW?
        </div>
        <div style={{ display: 'flex', fontSize: 56, lineHeight: 1.2 }}>
          {discovery?.headline ?? 'A finding from the Bible Timeline Explorer dataset.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 24 }}>
          <div style={{ display: 'flex', color: '#a1a1aa' }}>
            {discovery
              ? `Drawn from ${discovery.population}, under the ${discovery.chronologyId} chronology.`
              : ''}
          </div>
          <div style={{ display: 'flex', color: '#d6a85a' }}>Bible Timeline Explorer</div>
        </div>
      </div>
    ),
    size,
  );
}
