import { randomBytes } from 'node:crypto';
import {
  sealBankDetails,
  openBankDetails,
  financeVaultReady,
  FinanceVaultUnavailable,
} from '../src/finance-vault.js';
const original = process.env.FINANCE_VAULT_KEYS,
  originalFile = process.env.FINANCE_VAULT_KEYS_FILE;
afterEach(() => {
  if (original === undefined) delete process.env.FINANCE_VAULT_KEYS;
  else process.env.FINANCE_VAULT_KEYS = original;
  if (originalFile === undefined) delete process.env.FINANCE_VAULT_KEYS_FILE;
  else process.env.FINANCE_VAULT_KEYS_FILE = originalFile;
});
function config() {
  delete process.env.FINANCE_VAULT_KEYS_FILE;
  const key = randomBytes(32).toString('base64');
  process.env.FINANCE_VAULT_KEYS = JSON.stringify({ activeKeyId: 'v1', keys: { v1: key } });
  return key;
}
it('fails closed without a valid key and never substitutes a development key', () => {
  delete process.env.FINANCE_VAULT_KEYS_FILE;
  delete process.env.FINANCE_VAULT_KEYS;
  expect(financeVaultReady()).toBe(false);
  expect(() => sealBankDetails({}, 'context')).toThrow(FinanceVaultUnavailable);
  process.env.FINANCE_VAULT_KEYS = 'invalid';
  expect(financeVaultReady()).toBe(false);
});
it('uses random IVs and authenticated profile context without retaining plaintext in the envelope', () => {
  config();
  const bank = { accountHolder: 'Fixture', sortCode: '108800', accountNumber: '00012345' },
    one = sealBankDetails(bank, 'profile:identity:1'),
    two = sealBankDetails(bank, 'profile:identity:1');
  expect(JSON.stringify(one)).not.toContain(bank.accountNumber);
  expect(one.iv).not.toBe(two.iv);
  expect(openBankDetails(one, 'profile:identity:1')).toEqual(bank);
  expect(() => openBankDetails(one, 'other-profile:identity:1')).toThrow();
  const changed = { ...one, ciphertext: Buffer.alloc(20).toString('base64') };
  expect(() => openBankDetails(changed, 'profile:identity:1')).toThrow();
});
it('can read an old key after rotation but refuses a missing old key', () => {
  const old = config(),
    sealed = sealBankDetails({ accountNumber: '00012345' }, 'context'),
    next = randomBytes(32).toString('base64');
  process.env.FINANCE_VAULT_KEYS = JSON.stringify({
    activeKeyId: 'v2',
    keys: { v1: old, v2: next },
  });
  expect(openBankDetails(sealed, 'context')).toEqual({ accountNumber: '00012345' });
  expect(sealBankDetails({}, 'context').keyId).toBe('v2');
  process.env.FINANCE_VAULT_KEYS = JSON.stringify({ activeKeyId: 'v2', keys: { v2: next } });
  expect(() => openBankDetails(sealed, 'context')).toThrow(FinanceVaultUnavailable);
});
