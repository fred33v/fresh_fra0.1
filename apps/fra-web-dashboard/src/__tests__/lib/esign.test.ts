import { signingTimestamp, validateLayout, type SigningField, type Signer } from '@/lib/esign';
const signer = { id: 's1' } as Signer;
const field: SigningField = {
  signerId: 's1',
  page: 0,
  x: 10,
  y: 10,
  width: 100,
  height: 30,
  kind: 'signature',
};
const pages = [{ width: 595, height: 842 }];
it('requires a signature for every recipient, not just name or date fields', () => {
  expect(validateLayout([{ ...field, kind: 'name' }], [signer], pages)).toMatch(/signature field/);
  expect(validateLayout([field], [signer, { id: 's2' } as Signer], pages)).toMatch(
    /signature field/
  );
  expect(validateLayout([field], [signer], pages)).toBeNull();
});
it.each([
  { x: -1 },
  { x: 550 },
  { y: 830 },
  { page: 1 },
  { page: 0.5 },
  { width: 39 },
  { height: 19 },
  { x: NaN },
  { signerId: 'someone-else' },
])('rejects off-page or invalid placement %j', (patch) => {
  expect(validateLayout([{ ...field, ...patch }], [signer], pages)).toMatch(/inside/);
});

it('normalises retained PostgreSQL timestamps for browsers with strict ISO parsing', () => {
  expect(signingTimestamp('2026-11-18 07:12:34.123456+00').toISOString()).toBe(
    '2026-11-18T07:12:34.123Z'
  );
  expect(signingTimestamp('2026-11-18 09:12:34.123456+02').toISOString()).toBe(
    '2026-11-18T07:12:34.123Z'
  );
  expect(signingTimestamp('2026-11-18T07:12:34.123Z').toISOString()).toBe(
    '2026-11-18T07:12:34.123Z'
  );
});
