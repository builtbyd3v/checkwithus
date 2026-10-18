import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'checkwith.us: scam protection the family runs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// ImageResponse (satori) takes inline styles only, not Tailwind classes.
// ponytail: built-in font (Geist), not Gabarito; loading Google Fonts at build time needs the network.
export default async function OpengraphImage() {
  const icon = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/app-icon.png'))).toString('base64')}`;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 96, background: '#a62fea', color: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <img src={icon} width={150} height={150} alt="" style={{ borderRadius: 34 }} />
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4 }}>checkwith.us</div>
      </div>
      <div style={{ marginTop: 44, fontSize: 52, fontWeight: 600, lineHeight: 1.2 }}>Scam protection the family runs.</div>
      <div style={{ marginTop: 52, width: 220, height: 16, borderRadius: 8, background: '#fbc02d' }} />
    </div>,
    size,
  );
}
