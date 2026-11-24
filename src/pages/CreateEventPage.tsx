import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HostShell } from '@/components/layout/HostShell';
import { useAuth } from '@/contexts/AuthContext';
import { createEvent, uploadEventBanner } from '@/services/events';
import { slugify } from '@/lib/slug';
import { naira } from '@/lib/format';

interface TierDraft {
  key: string;
  name: string;
  description: string;
  price: string;
  quantity: string;
}

const newTier = (name = '', price = '', quantity = '', description = ''): TierDraft => ({
  key: Math.random().toString(36).slice(2),
  name,
  description,
  price,
  quantity,
});

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tiers, setTiers] = useState<TierDraft[]>([newTier('Regular', '5000', '100')]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateTier = (key: string, patch: Partial<TierDraft>) => {
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)));
  };

  const handleBanner = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file (JPG, PNG or WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Keep the banner under 5MB.');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadEventBanner(user.id, file);
      setBannerUrl(url);
      toast.success('Banner uploaded');
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setError('');

    if (title.trim().length < 3) {
      setError('Give your event a title of at least 3 characters.');
      return;
    }
    if (!eventDate) {
      setError('Choose the date and time of your event.');
      return;
    }
    if (venue.trim().length < 3) {
      setError('Add the venue or location.');
      return;
    }

    const cleanedTiers = tiers
      .map((tier) => ({
        name: tier.name.trim(),
        description: tier.description.trim().slice(0, 300),
        price_ngn: Math.max(0, Math.round(Number(tier.price || 0))),
        quantity_total: Math.max(0, Math.round(Number(tier.quantity || 0))),
      }))
      .filter((tier) => tier.name.length > 0);

    if (cleanedTiers.length === 0) {
      setError('Add at least one ticket tier.');
      return;
    }
    if (cleanedTiers.some((tier) => tier.quantity_total <= 0)) {
      setError('Every tier needs a quantity greater than zero.');
      return;
    }
    if (cleanedTiers.some((tier) => !Number.isFinite(tier.price_ngn))) {
      setError('Ticket prices must be valid Naira amounts.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEvent({
        title: title.trim(),
        slug: slugify(title),
        description: description.trim(),
        event_date: new Date(eventDate).toISOString(),
        venue: venue.trim(),
        banner_url: bannerUrl || null,
        tiers: cleanedTiers,
      });
      toast.success('Event published');
      navigate(`/dashboard/events/${created.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create the event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <HostShell>
      <div className="border-b border-border bg-card/60">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-electric">New event</p>
          <h1 className="mt-1.5 font-display text-xl font-semibold text-balance md:text-3xl">
            Create an event
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish now — you can edit details later from the event dashboard.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-card p-4 shadow-card md:p-6">
            <h2 className="font-display text-base font-semibold">Event details</h2>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Event title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Lagos Sound System — Detty December"
                  className="h-11 px-3"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What should guests expect? Line-up, dress code, parking, anything useful."
                  rows={5}
                  className="px-3 py-2.5"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="eventDate">Date &amp; time</Label>
                  <Input
                    id="eventDate"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                    className="h-11 px-3"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="venue">Venue / location</Label>
                  <Input
                    id="venue"
                    value={venue}
                    onChange={(event) => setVenue(event.target.value)}
                    placeholder="Eko Hotel, Victoria Island, Lagos"
                    className="h-11 px-3"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Event banner</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleBanner(event.target.files?.[0])}
                />

                {bannerUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <div className="aspect-[16/9] w-full bg-muted">
                      <img
                        src={bannerUrl}
                        alt="Event banner preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setBannerUrl('')}
                      className="absolute right-2 top-2 h-9 w-9 border border-border bg-card/90 text-foreground hover:bg-card"
                      aria-label="Remove banner"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:border-electric/60 hover:bg-muted"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-electric" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-electric" />
                    )}
                    <span className="text-sm font-medium">
                      {uploading ? 'Uploading…' : 'Upload a flyer'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG or WEBP · up to 5MB
                    </span>
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-card md:p-6">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold">Ticket tiers</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set ₦0 for free tickets. Buyers pay a flat ₦350 fee on paid orders.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setTiers((current) => [...current, newTier()])}
                className="mt-3 shrink-0 md:mt-0"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add tier
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {tiers.map((tier, index) => (
                <div
                  key={tier.key}
                  className="rounded-lg border border-border bg-background/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Tier {index + 1}
                    </span>
                    {tiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setTiers((current) => current.filter((item) => item.key !== tier.key))
                        }
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove tier ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="mt-2 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`tier-name-${tier.key}`} className="text-xs">
                        Tier name
                      </Label>
                      <Input
                        id={`tier-name-${tier.key}`}
                        value={tier.name}
                        onChange={(event) => updateTier(tier.key, { name: event.target.value })}
                        placeholder="VIP"
                        className="h-10 px-3"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`tier-price-${tier.key}`} className="text-xs">
                        Price (₦)
                      </Label>
                      <Input
                        id={`tier-price-${tier.key}`}
                        type="number"
                        min={0}
                        step={100}
                        value={tier.price}
                        onChange={(event) => updateTier(tier.key, { price: event.target.value })}
                        placeholder="5000"
                        className="h-10 px-3"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`tier-qty-${tier.key}`} className="text-xs">
                        Quantity
                      </Label>
                      <Input
                        id={`tier-qty-${tier.key}`}
                        type="number"
                        min={1}
                        step={1}
                        value={tier.quantity}
                        onChange={(event) => updateTier(tier.key, { quantity: event.target.value })}
                        placeholder="100"
                        className="h-10 px-3"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5">
                    <Label htmlFor={`tier-desc-${tier.key}`} className="text-xs">
                      What's included <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id={`tier-desc-${tier.key}`}
                      value={tier.description}
                      maxLength={300}
                      rows={2}
                      onChange={(event) => updateTier(tier.key, { description: event.target.value })}
                      placeholder="e.g. Front-row seating, free drink, fast-lane entry"
                      className="px-3 py-2"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {tier.description.length}/300
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Buyer pays{' '}
                    <span className="font-medium text-foreground">
                      {naira(Number(tier.price || 0))}
                    </span>{' '}
                    per ticket
                    {Number(tier.price || 0) > 0 ? ' + ₦350 once per order' : ' · no service fee'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className="w-full md:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="w-full md:w-auto">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish event
            </Button>
          </div>
        </div>
      </form>
    </HostShell>
  );
}
