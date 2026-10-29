import { titleForPath } from '@/lib/route-titles';

describe('titleForPath', () => {
  it.each([
    ['/auth', 'Sign in or create an account — Risk Aware'],
    ['/join', 'Join your organisation — Risk Aware'],
    ['/dashboard', 'Your dashboard — Risk Aware'],
    ['/assessment', 'Risk assessment — Risk Aware'],
    ['/assessment/abc-123/results', 'Assessment results — Risk Aware'],
    ['/package/enterprise', 'Enterprise package — Risk Aware'],
    ['/checkout', 'Checkout — Risk Aware'],
    ['/checkout/complete', 'Payment complete — Risk Aware'],
    ['/employer', 'Organisation dashboard — Risk Aware'],
    ['/speak-up/some-token', 'Speak up — Risk Aware'],
  ])('%s is "%s"', (path, title) => {
    expect(titleForPath(path)).toBe(title);
  });

  it('keeps the full site title on the home page', () => {
    expect(titleForPath('/')).toBe('Risk Aware — Fraud Risk Assessment Platform');
  });

  it('says so for an unknown page', () => {
    expect(titleForPath('/nothing-here')).toBe('Page not found — Risk Aware');
  });

  it('gives every page a different title', () => {
    const paths = ['/auth', '/join', '/dashboard', '/workshop', '/assessment', '/resources', '/certificate', '/action-plan', '/privacy', '/terms', '/employer', '/profile'];
    expect(new Set(paths.map(titleForPath)).size).toBe(paths.length);
  });
});
