/** Only canonical checkout destinations may accompany verification emails. */
export function checkoutReturnPath(value?: string): string | undefined {
  if (!value || value.length > 500 || !value.startsWith('/checkout?') || /[\u0000-\u001f\u007f\\]/.test(value)) return;
  const url = new URL(value, 'https://checkout.invalid');
  if (url.pathname !== '/checkout' || url.hash) return;
  const params = url.searchParams;
  if ([...params.keys()].some(key => !['package', 'provider'].includes(key) || params.getAll(key).length !== 1)) return;
  const selected = params.get('package');
  if (!selected || !['Starter', 'Professional', 'Enterprise'].includes(selected)) return;
  const provider = params.get('provider');
  if (provider !== null && !/^PRV-[a-f0-9]{32}$/.test(provider)) return;
  const canonical = new URLSearchParams({ package: selected });
  if (provider) canonical.set('provider', provider);
  return `/checkout?${canonical.toString()}`;
}
