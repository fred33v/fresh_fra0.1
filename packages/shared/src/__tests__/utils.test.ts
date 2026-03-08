import { describe, it, expect } from 'vitest';
import {
  calculateInherentRisk,
  calculateResidualRisk,
  getRiskPriority,
  formatDateUK,
  generateKeyPassCode,
  isValidEmail,
  calculateCompletionPercentage,
  sanitizeString,
} from '../utils';

describe('calculateInherentRisk', () => {
  it('returns impact * likelihood for normal values', () => {
    expect(calculateInherentRisk(3, 4)).toBe(12);
    expect(calculateInherentRisk(2, 3)).toBe(6);
    expect(calculateInherentRisk(5, 5)).toBe(25);
    expect(calculateInherentRisk(1, 1)).toBe(1);
  });

  it('clamps result to minimum of 1', () => {
    expect(calculateInherentRisk(0, 0)).toBe(1);
    expect(calculateInherentRisk(-1, 5)).toBe(1);
    expect(calculateInherentRisk(0, 5)).toBe(1);
  });

  it('clamps result to maximum of 25', () => {
    expect(calculateInherentRisk(6, 5)).toBe(25);
    expect(calculateInherentRisk(10, 10)).toBe(25);
    expect(calculateInherentRisk(5, 6)).toBe(25);
  });

  it('handles edge case at boundaries', () => {
    expect(calculateInherentRisk(5, 5)).toBe(25);
    expect(calculateInherentRisk(1, 1)).toBe(1);
  });
});

describe('calculateResidualRisk', () => {
  it('applies VERY_STRONG reduction (40%)', () => {
    expect(calculateResidualRisk(20, 'VERY_STRONG')).toBe(12);
    expect(calculateResidualRisk(10, 'VERY_STRONG')).toBe(6);
  });

  it('applies REASONABLY_STRONG reduction (20%)', () => {
    expect(calculateResidualRisk(20, 'REASONABLY_STRONG')).toBe(16);
    expect(calculateResidualRisk(10, 'REASONABLY_STRONG')).toBe(8);
  });

  it('applies SOME_GAPS reduction (0%)', () => {
    expect(calculateResidualRisk(20, 'SOME_GAPS')).toBe(20);
    expect(calculateResidualRisk(15, 'SOME_GAPS')).toBe(15);
  });

  it('applies WEAK reduction (0%)', () => {
    expect(calculateResidualRisk(20, 'WEAK')).toBe(20);
    expect(calculateResidualRisk(15, 'WEAK')).toBe(15);
  });

  it('rounds to nearest integer', () => {
    // 15 * 0.6 = 9
    expect(calculateResidualRisk(15, 'VERY_STRONG')).toBe(9);
    // 7 * 0.8 = 5.6 → rounds to 6
    expect(calculateResidualRisk(7, 'REASONABLY_STRONG')).toBe(6);
    // 3 * 0.6 = 1.8 → rounds to 2
    expect(calculateResidualRisk(3, 'VERY_STRONG')).toBe(2);
  });
});

describe('getRiskPriority', () => {
  it('returns LOW for scores 1-7', () => {
    expect(getRiskPriority(1)).toBe('LOW');
    expect(getRiskPriority(5)).toBe('LOW');
    expect(getRiskPriority(7)).toBe('LOW');
  });

  it('returns MEDIUM for scores 8-14', () => {
    expect(getRiskPriority(8)).toBe('MEDIUM');
    expect(getRiskPriority(10)).toBe('MEDIUM');
    expect(getRiskPriority(14)).toBe('MEDIUM');
  });

  it('returns HIGH for scores 15-25', () => {
    expect(getRiskPriority(15)).toBe('HIGH');
    expect(getRiskPriority(20)).toBe('HIGH');
    expect(getRiskPriority(25)).toBe('HIGH');
  });

  it('handles boundary values correctly', () => {
    expect(getRiskPriority(7)).toBe('LOW');
    expect(getRiskPriority(8)).toBe('MEDIUM');
    expect(getRiskPriority(14)).toBe('MEDIUM');
    expect(getRiskPriority(15)).toBe('HIGH');
  });
});

describe('formatDateUK', () => {
  it('formats a Date object to UK format', () => {
    const date = new Date('2024-03-15T00:00:00Z');
    const result = formatDateUK(date);
    expect(result).toMatch(/15\/03\/2024/);
  });

  it('formats an ISO date string to UK format', () => {
    const result = formatDateUK('2024-12-25');
    expect(result).toMatch(/25\/12\/2024/);
  });

  it('returns "Invalid date" for invalid date input', () => {
    expect(formatDateUK('not-a-date')).toBe('Invalid date');
    expect(formatDateUK(new Date('invalid'))).toBe('Invalid date');
  });
});

describe('generateKeyPassCode', () => {
  it('uses default FRA prefix', () => {
    const code = generateKeyPassCode();
    expect(code).toMatch(/^FRA-/);
  });

  it('uses custom prefix', () => {
    const code = generateKeyPassCode('TEST');
    expect(code).toMatch(/^TEST-/);
  });

  it('matches expected format: PREFIX-TIMESTAMP-RANDOM', () => {
    const code = generateKeyPassCode();
    const parts = code.split('-');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('FRA');
    // Timestamp part should be uppercase alphanumeric (base36)
    expect(parts[1]).toMatch(/^[A-Z0-9]+$/);
    // Random part should be 8 uppercase hex/alphanumeric characters
    expect(parts[2]).toMatch(/^[A-Z0-9]+$/);
    expect(parts[2].length).toBe(8);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateKeyPassCode()));
    expect(codes.size).toBe(100);
  });
});

describe('isValidEmail', () => {
  it('accepts valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
    expect(isValidEmail('firstname.lastname@company.com')).toBe(true);
  });

  it('rejects emails with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
    expect(isValidEmail(' user@example.com')).toBe(false);
    expect(isValidEmail('user@example .com')).toBe(false);
  });

  it('rejects emails with double @', () => {
    expect(isValidEmail('a@@b.com')).toBe(false);
    expect(isValidEmail('user@@example.com')).toBe(false);
  });

  it('rejects emails without proper domain', () => {
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
  });

  it('rejects emails without TLD', () => {
    expect(isValidEmail('user@domain.')).toBe(false);
    expect(isValidEmail('user@.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('calculateCompletionPercentage', () => {
  it('calculates percentage correctly', () => {
    expect(calculateCompletionPercentage(['a', 'b', 'c'], 10)).toBe(30);
    expect(calculateCompletionPercentage(['a', 'b', 'c', 'd', 'e'], 10)).toBe(50);
    expect(calculateCompletionPercentage(['a'], 3)).toBe(33);
  });

  it('returns 100 when all modules complete', () => {
    expect(calculateCompletionPercentage(['a', 'b', 'c'], 3)).toBe(100);
  });

  it('returns 0 for empty array', () => {
    expect(calculateCompletionPercentage([], 10)).toBe(0);
  });

  it('returns 0 when totalModules is 0 (division by zero guard)', () => {
    expect(calculateCompletionPercentage([], 0)).toBe(0);
    expect(calculateCompletionPercentage(['a'], 0)).toBe(0);
  });
});

describe('sanitizeString', () => {
  it('escapes < and >', () => {
    expect(sanitizeString('<script>')).toBe('&lt;script&gt;');
    expect(sanitizeString('a < b > c')).toBe('a &lt; b &gt; c');
  });

  it('escapes double quotes', () => {
    expect(sanitizeString('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeString("it's")).toBe('it&#x27;s');
  });

  it('escapes all special characters together', () => {
    expect(sanitizeString('<a href="test">it\'s</a>')).toBe(
      '&lt;a href=&quot;test&quot;&gt;it&#x27;s&lt;/a&gt;'
    );
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeString('hello world')).toBe('hello world');
  });
});

describe('validatePasswordStrength', () => {
  it('rejects weak passwords', () => {
    const result = validatePasswordStrength('abc');
    expect(result.isValid).toBe(false);
    expect(result.requirements.minLength).toBe(false);
  });

  it('validates strong passwords with all requirements', () => {
    const result = validatePasswordStrength('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.requirements.minLength).toBe(true);
    expect(result.requirements.hasUppercase).toBe(true);
    expect(result.requirements.hasLowercase).toBe(true);
    expect(result.requirements.hasNumber).toBe(true);
    expect(result.requirements.hasSpecialChar).toBe(true);
    expect(result.score).toBe(5);
  });

  it('detects missing uppercase', () => {
    const result = validatePasswordStrength('securepass123!');
    expect(result.isValid).toBe(false);
    expect(result.requirements.hasUppercase).toBe(false);
  });

  it('detects missing lowercase', () => {
    const result = validatePasswordStrength('SECUREPASS123!');
    expect(result.isValid).toBe(false);
    expect(result.requirements.hasLowercase).toBe(false);
  });

  it('detects missing number', () => {
    const result = validatePasswordStrength('SecurePass!');
    expect(result.isValid).toBe(false);
    expect(result.requirements.hasNumber).toBe(false);
  });

  it('detects missing special character', () => {
    const result = validatePasswordStrength('SecurePass123');
    expect(result.isValid).toBe(false);
    expect(result.requirements.hasSpecialChar).toBe(false);
  });

  it('calculates score correctly for partial requirements', () => {
    const result = validatePasswordStrength('Password123');
    expect(result.score).toBe(4); // Has all except special char
  });
});

describe('hashString', () => {
  it('generates consistent hash for same input', async () => {
    const hash1 = await hashString('test-string');
    const hash2 = await hashString('test-string');
    expect(hash1).toBe(hash2);
  });

  it('generates different hash for different input', async () => {
    const hash1 = await hashString('string1');
    const hash2 = await hashString('string2');
    expect(hash1).not.toBe(hash2);
  });

  it('returns hex string (64 chars for SHA-256)', async () => {
    const hash = await hashString('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles empty string', async () => {
    const hash = await hashString('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('parseJWT', () => {
  it('parses valid JWT token format', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = parseJWT(token);
    
    expect(result).not.toBeNull();
    expect(result?.header).toBeDefined();
    expect(result?.payload).toBeDefined();
    expect(result?.signature).toBeDefined();
  });

  it('extracts payload claims correctly', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNjMyNDUyMDAwfQ.signature';
    const result = parseJWT(token);
    
    expect(result?.payload.sub).toBe('user123');
    expect(result?.payload.exp).toBe(1632452000);
  });

  it('returns null for invalid token format', () => {
    expect(parseJWT('invalid')).toBeNull();
    expect(parseJWT('two.parts')).toBeNull();
    expect(parseJWT('')).toBeNull();
  });

  it('returns null for malformed parts', () => {
    expect(parseJWT('!!!.!!!.!!!')).toBeNull();
  });
});

describe('formatCurrencyGBP', () => {
  it('formats integer amounts', () => {
    expect(formatCurrencyGBP(100)).toBe('£100.00');
    expect(formatCurrencyGBP(1000)).toBe('£1,000.00');
  });

  it('formats decimal amounts', () => {
    expect(formatCurrencyGBP(1234.56)).toBe('£1,234.56');
    expect(formatCurrencyGBP(0.99)).toBe('£0.99');
  });

  it('respects decimal places parameter', () => {
    expect(formatCurrencyGBP(100, 0)).toBe('£100');
    expect(formatCurrencyGBP(100.456, 1)).toBe('£100.5');
    expect(formatCurrencyGBP(100.456, 3)).toBe('£100.456');
  });

  it('handles zero', () => {
    expect(formatCurrencyGBP(0)).toBe('£0.00');
  });

  it('handles large amounts', () => {
    expect(formatCurrencyGBP(1000000)).toBe('£1,000,000.00');
  });
});

describe('generateUUID', () => {
  it('generates valid UUID v4 format', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('generates unique UUIDs', () => {
    const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(uuids.size).toBe(100);
  });
});
