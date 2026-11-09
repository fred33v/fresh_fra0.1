import { titleForPath } from '@/lib/route-titles';

describe('titleForPath', () => {
  it.each([
    ['/auth', 'Sign in or create an account — fraud-risk.co.uk'],
    ['/join', 'Join your organisation — fraud-risk.co.uk'],
    ['/dashboard', 'Your dashboard — fraud-risk.co.uk'],
    ['/assessment', 'Risk assessment — fraud-risk.co.uk'],
    ['/assessment/abc-123/results', 'Assessment results — fraud-risk.co.uk'],
    ['/package/enterprise', 'Enterprise package — fraud-risk.co.uk'],
    ['/checkout', 'Checkout — fraud-risk.co.uk'],
    ['/checkout/complete', 'Payment complete — fraud-risk.co.uk'],
    ['/employer', 'Organisation dashboard — fraud-risk.co.uk'],
    ['/speak-up/some-token', 'Speak up — fraud-risk.co.uk'],
  ])('%s is "%s"', (path, title) => {
    expect(titleForPath(path)).toBe(title);
  });

  it('keeps the full site title on the home page', () => {
    expect(titleForPath('/')).toBe('Fraud risk assessment and training for UK organisations — fraud-risk.co.uk');
  });

  it('says so for an unknown page', () => {
    expect(titleForPath('/nothing-here')).toBe('Page not found — fraud-risk.co.uk');
  });

  it('gives every page a different title', () => {
    const paths = ['/auth', '/join', '/dashboard', '/workshop', '/assessment', '/resources', '/certificate', '/action-plan', '/privacy', '/terms', '/accessibility', '/employer', '/profile'];
    expect(new Set(paths.map(titleForPath)).size).toBe(paths.length);
  });
});
