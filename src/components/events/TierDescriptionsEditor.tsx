import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateTierDescription } from '@/services/events';
import type { TicketTier } from '@/types/types';

export const TIER_DESCRIPTION_MAX = 300;

interface Props {
  tiers: TicketTier[];
  onSaved: (tierId: string, description: string) => void;
}

export function TierDescriptionsEditor({ tiers, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const valueFor = (tier: TicketTier) => drafts[tier.id] ?? tier.description ?? '';

  const handleSave = async (tier: TicketTier) => {
    const next = valueFor(tier).trim().slice(0, TIER_DESCRIPTION_MAX);
    setSavingId(tier.id);
    try {
      await updateTierDescription(tier.id, next);
      onSaved(tier.id, next);
      setDrafts((current) => {
        const { [tier.id]: _removed, ...rest } = current;
        return rest;
      });
      toast.success(`${tier.name} description saved`);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save the description');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-base font-semibold">Tier descriptions</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Shown to buyers under each ticket type, so they know what they are paying for.
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {tiers.map((tier) => {
          const value = valueFor(tier);
          const changed = value.trim() !== (tier.description ?? '').trim();
          return (
            <div key={tier.id} className="flex flex-col gap-1.5">
              <Label htmlFor={`tier-desc-${tier.id}`} className="text-xs">
                {tier.name}
              </Label>
              <Textarea
                id={`tier-desc-${tier.id}`}
                value={value}
                maxLength={TIER_DESCRIPTION_MAX}
                rows={3}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [tier.id]: event.target.value }))
                }
                placeholder="e.g. Front-row seating, free drink, fast-lane entry"
                className="px-3 py-2"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {value.length}/{TIER_DESCRIPTION_MAX}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={!changed || savingId === tier.id}
                  onClick={() => handleSave(tier)}
                >
                  {savingId === tier.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
