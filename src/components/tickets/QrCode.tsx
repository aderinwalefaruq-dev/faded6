import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { qrDataUrl } from '@/lib/qr';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 220, className }: QrCodeProps) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    qrDataUrl(value, size * 2)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className={cn('animate-pulse rounded-lg bg-muted', className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={cn('rounded-lg bg-white', className)}
    />
  );
}
