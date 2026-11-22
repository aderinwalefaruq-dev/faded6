import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  QrCode as QrIcon,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QrCode } from '@/components/tickets/QrCode';
import { getEventById } from '@/services/events';
import { scanTicket } from '@/services/orders';
import { formatDateTime, formatEventDate } from '@/lib/format';
import { publicEventUrl } from '@/lib/slug';
import type { EventWithTiers, ScanResult } from '@/types/types';

const SCANNER_ELEMENT_ID = 'faded6-qr-reader';
const RESULT_HOLD_MS = 2600;

export default function ScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventWithTiers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [walkUpOpen, setWalkUpOpen] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    getEventById(eventId)
      .then((row) => {
        if (!active) return;
        if (!row) setError('This event does not exist or you do not manage it.');
        else setEvent(row);
      })
      .catch((loadError: Error) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // scanner was already stopped
    }
    setScanning(false);
  }, []);

  const runCheck = useCallback(
    async (code: string) => {
      if (!eventId) return;
      try {
        const scanResult = await scanTicket(eventId, code);
        setResult(scanResult);
        if (scanResult.result === 'valid') setSessionCount((count) => count + 1);
      } catch (scanError) {
        setResult({
          result: 'invalid',
          message: scanError instanceof Error ? scanError.message : 'Scanner error',
        });
      }
    },
    [eventId],
  );

  const handleDecoded = useCallback(
    async (decodedText: string) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const scanner = scannerRef.current;
      if (scanner) {
        try {
          scanner.pause(true);
        } catch {
          // ignore pause failures
        }
      }

      await runCheck(decodedText.trim());

      holdTimerRef.current = window.setTimeout(() => {
        setResult(null);
        busyRef.current = false;
        const activeScanner = scannerRef.current;
        if (activeScanner) {
          try {
            activeScanner.resume();
          } catch {
            // ignore resume failures
          }
        }
      }, RESULT_HOLD_MS);
    },
    [runCheck],
  );

  const handleManualCheck = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code || manualBusy) return;

    setManualBusy(true);
    busyRef.current = true;
    await runCheck(code);
    setManualCode('');
    setManualBusy(false);

    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      setResult(null);
      busyRef.current = false;
    }, RESULT_HOLD_MS);
  };

  const startScanner = useCallback(async () => {
    setCameraError('');
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          void handleDecoded(decodedText);
        },
        () => {
          // per-frame decode misses are expected
        },
      );
      setScanning(true);
    } catch (startError) {
      scannerRef.current = null;
      setCameraError(
        startError instanceof Error
          ? startError.message
          : 'Camera access was blocked. Allow camera permissions and try again.',
      );
    }
  }, [handleDecoded]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner.stop().catch(() => undefined);
      }
    };
  }, []);

  const resetResult = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    setResult(null);
    busyRef.current = false;
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        scanner.resume();
      } catch {
        // ignore
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-electric" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
        <ShieldAlert className="h-8 w-8 text-electric" />
        <h1 className="mt-4 font-display text-xl font-semibold">Scanner unavailable</h1>
        <p className="mt-2 max-w-sm text-sm text-foreground/70 text-pretty">
          {error || 'Event not found'}
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const shareUrl = publicEventUrl(event.slug);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/10">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 border border-border/25 text-foreground hover:bg-secondary/10"
          >
            <Link to={`/dashboard/events/${event.id}`} aria-label="Back to event">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-electric">Gate scanner</p>
            <h1 className="truncate font-display text-base font-semibold">{event.title}</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-foreground/50">
              Admitted
            </p>
            <p className="font-display text-base font-semibold text-electric">{sessionCount}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5">
        <p className="text-center text-xs text-foreground/60">
          {formatEventDate(event.event_date)} · {event.venue}
        </p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-border/15 bg-black/40">
          <div className="scan-brackets relative aspect-square w-full">
            <div id={SCANNER_ELEMENT_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          </div>

          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center">
              {cameraError ? (
                <>
                  <CameraOff className="h-8 w-8 text-destructive" />
                  <p className="max-w-xs text-sm text-foreground/80 text-pretty">
                    {cameraError}
                  </p>
                  <Button variant="secondary" onClick={startScanner}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try again
                  </Button>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-electric" />
                  <p className="max-w-xs text-sm text-foreground/70 text-pretty">
                    Point the camera at a guest&apos;s ticket QR code. Nothing is uploaded — the
                    check happens instantly.
                  </p>
                  <Button onClick={startScanner}>
                    <Camera className="mr-2 h-4 w-4" />
                    Start camera
                  </Button>
                </>
              )}
            </div>
          )}

          {result && (
            <div
              className={
                result.result === 'valid'
                  ? 'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-success px-6 text-center text-success-foreground'
                  : result.result === 'already_used'
                    ? 'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-warning px-6 text-center text-warning-foreground'
                    : 'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive px-6 text-center text-destructive-foreground'
              }
            >
              {result.result === 'valid' ? (
                <CheckCircle2 className="h-12 w-12" />
              ) : result.result === 'already_used' ? (
                <TriangleAlert className="h-12 w-12" />
              ) : (
                <XCircle className="h-12 w-12" />
              )}

              <p className="font-display text-xl font-semibold uppercase tracking-wide">
                {result.result === 'valid'
                  ? 'Valid ticket'
                  : result.result === 'already_used'
                    ? 'Already used'
                    : result.result === 'wrong_event'
                      ? 'Wrong event'
                      : 'Invalid ticket'}
              </p>

              {result.result === 'valid' && (
                <p className="text-sm font-medium uppercase tracking-[0.2em]">Admit one</p>
              )}

              {result.ticket && (
                <div className="mt-1">
                  <p className="font-display text-lg font-semibold">{result.ticket.buyer_name}</p>
                  <p className="text-sm uppercase tracking-[0.16em]">{result.ticket.tier_name}</p>
                </div>
              )}

              {result.result === 'already_used' && result.ticket?.checked_in_at && (
                <p className="mt-1 text-sm">
                  First scanned {formatDateTime(result.ticket.checked_in_at)}
                </p>
              )}

              {result.message && result.result !== 'valid' && (
                <p className="mt-1 max-w-xs text-sm opacity-90 text-pretty">{result.message}</p>
              )}

              <Button
                variant="ghost"
                onClick={resetResult}
                className="mt-3 border border-white/40 text-current hover:bg-white/10"
              >
                Scan next
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          {scanning ? (
            <Button
              variant="ghost"
              onClick={stopScanner}
              className="w-full border border-border/25 text-foreground hover:bg-secondary/10 md:w-auto"
            >
              <CameraOff className="mr-2 h-4 w-4" />
              Stop camera
            </Button>
          ) : (
            <Button variant="secondary" onClick={startScanner} className="w-full md:w-auto">
              <Camera className="mr-2 h-4 w-4" />
              Start camera
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => setWalkUpOpen(true)}
            className="w-full border border-electric/50 text-electric hover:bg-electric/10 md:w-auto"
          >
            <QrIcon className="mr-2 h-4 w-4" />
            Show gate purchase QR
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-border/15 bg-secondary/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-electric">Manual check</p>
          <p className="mt-1 text-xs text-foreground/60 text-pretty">
            Camera not cooperating? Type the code printed under the guest&apos;s QR.
          </p>
          <form onSubmit={handleManualCheck} className="mt-2 flex gap-2">
            <Input
              value={manualCode}
              onChange={(changeEvent) => setManualCode(changeEvent.target.value)}
              placeholder="F6-0000-AA"
              aria-label="Ticket code"
              autoCapitalize="characters"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 border-border/25 bg-secondary/10 px-3 font-mono text-sm uppercase text-foreground placeholder:text-foreground/35"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!manualCode.trim() || manualBusy}
              className="shrink-0"
            >
              {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
            </Button>
          </form>
        </div>

        <div className="mt-6 grid gap-2 text-xs text-foreground/60">
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
            Green — valid, guest is admitted and the ticket is marked used.
          </p>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
            Orange — already scanned, with the original check-in time.
          </p>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
            Red — not a ticket for this event.
          </p>
        </div>
      </main>

      <Dialog open={walkUpOpen} onOpenChange={setWalkUpOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Walk-up purchase</DialogTitle>
            <DialogDescription>
              Show this to guests at the entrance so they can buy a ticket on the spot.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border border-border bg-white p-4">
              <QrCode value={shareUrl} size={220} />
            </div>
            <p className="break-all text-center font-mono text-xs text-muted-foreground">
              {shareUrl}
            </p>
            <p className="text-center text-xs text-muted-foreground text-pretty">
              Guests pay with Paystack and receive their QR ticket instantly — no account needed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
