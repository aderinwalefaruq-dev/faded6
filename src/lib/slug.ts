export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || 'event'}-${suffix}`;
}

export function publicEventUrl(slug: string): string {
  return `${window.location.origin}/e/${slug}`;
}

export function ticketUrl(reference: string): string {
  return `${window.location.origin}/t/${reference}`;
}
