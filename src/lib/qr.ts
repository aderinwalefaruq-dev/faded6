import QRCode from 'qrcode';

const QR_OPTIONS = {
  margin: 2,
  color: { dark: '#0A0A0C', light: '#FFFFFF' },
};

export async function qrDataUrl(value: string, size = 640): Promise<string> {
  return QRCode.toDataURL(value, { ...QR_OPTIONS, width: size });
}

export async function downloadQr(value: string, filename: string): Promise<void> {
  const url = await qrDataUrl(value, 720);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render the QR image'));
    image.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): number {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }

  if (lines.length < maxLines && current) lines.push(current);

  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const clipped =
      isLast && ctx.measureText(line).width > maxWidth
        ? `${line.slice(0, Math.max(0, line.length - 2))}…`
        : line;
    ctx.fillText(clipped, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

export interface GatePassPosterInput {
  eventTitle: string;
  eventDate: string;
  venue: string;
  url: string;
  filename: string;
}

/**
 * Renders the printable "Faded6 Instant Gate Pass" poster and downloads it as a PNG.
 */
export async function downloadGatePassPoster(input: GatePassPosterInput): Promise<void> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  ctx.fillStyle = '#0A0A0C';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < height; y += 9) {
    for (let x = 0; x < width; x += 9) {
      ctx.beginPath();
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = '#C8FF2E';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#C8FF2E';
  ctx.font = '700 64px "Space Grotesk", Inter, sans-serif';
  ctx.fillText('Faded6', 88, 152);

  ctx.fillStyle = 'rgba(244,244,245,0.55)';
  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText('TICKET PLATFORM', 88, 192);

  ctx.fillStyle = '#F4F4F5';
  ctx.font = '700 78px "Space Grotesk", Inter, sans-serif';
  ctx.fillText('INSTANT', 88, 312);

  ctx.fillStyle = '#C8FF2E';
  ctx.fillText('GATE PASS', 88, 396);

  ctx.fillStyle = '#F4F4F5';
  ctx.font = '600 40px "Space Grotesk", Inter, sans-serif';
  const afterTitle = wrapText(ctx, input.eventTitle, 88, 486, width - 176, 50, 2);

  ctx.fillStyle = 'rgba(244,244,245,0.6)';
  ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText(input.eventDate, 88, afterTitle + 34);
  ctx.fillText(input.venue, 88, afterTitle + 74);

  const qr = await QRCode.toDataURL(input.url, {
    margin: 1,
    width: 720,
    color: { dark: '#0A0A0C', light: '#FFFFFF' },
  });
  const image = await loadImage(qr);

  const qrSize = 440;
  const qrX = (width - qrSize) / 2;
  const qrY = 700;

  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, qrX - 26, qrY - 26, qrSize + 52, qrSize + 52, 26);
  ctx.fill();
  ctx.drawImage(image, qrX, qrY, qrSize, qrSize);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4F4F5';
  ctx.font = '600 36px "Space Grotesk", Inter, sans-serif';
  ctx.fillText('Skip the queue', width / 2, 1222);

  ctx.fillStyle = 'rgba(244,244,245,0.65)';
  ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText('Scan to buy your ticket on Faded6', width / 2, 1268);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = input.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
