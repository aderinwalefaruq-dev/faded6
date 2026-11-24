-- Lets hosts explain what each ticket tier includes (e.g. VIP vs Regular).
ALTER TABLE public.ticket_tiers
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.ticket_tiers
  ADD CONSTRAINT ticket_tiers_description_len CHECK (char_length(description) <= 300);
