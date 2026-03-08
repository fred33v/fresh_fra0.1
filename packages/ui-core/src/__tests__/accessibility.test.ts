import { describe, it, expect } from 'vitest';
import {
  getButtonAccessibilityLabel,
  getInputAccessibilityLabel,
  getInputAccessibilityHint,
  getCharacterCountLabel,
  getProgressAccessibilityLabel,
  getStatusAccessibilityLabel,
  generateTestID,
  ARIA_ROLES,
  LIVE_REGIONS,
} from '../accessibility/index.js';

// --- getButtonAccessibilityLabel ---

describe('getButtonAccessibilityLabel', () => {
  it('returns label as-is when no options are provided', () => {
    expect(getButtonAccessibilityLabel('Submit')).toBe('Submit');
  });

  it('appends "loading" when loading is true', () => {
    expect(getButtonAccessibilityLabel('Submit', { loading: true })).toBe('Submit, loading');
  });

  it('appends "disabled" when disabled is true', () => {
    expect(getButtonAccessibilityLabel('Submit', { disabled: true })).toBe('Submit, disabled');
  });

  it('appends both "loading" and "disabled" when both are true', () => {
    expect(getButtonAccessibilityLabel('Submit', { loading: true, disabled: true })).toBe(
      'Submit, loading, disabled'
    );
  });
});

// --- getInputAccessibilityLabel ---

describe('getInputAccessibilityLabel', () => {
  it('returns label as-is when no options are provided', () => {
    expect(getInputAccessibilityLabel('Email')).toBe('Email');
  });

  it('appends "required" when required is true', () => {
    expect(getInputAccessibilityLabel('Email', { required: true })).toBe('Email, required');
  });

  it('appends error message when error is provided', () => {
    expect(getInputAccessibilityLabel('Email', { error: 'Invalid email' })).toBe(
      'Email, error: Invalid email'
    );
  });

  it('includes both required and error when both provided', () => {
    expect(
      getInputAccessibilityLabel('Email', { required: true, error: 'Invalid email' })
    ).toBe('Email, required, error: Invalid email');
  });
});

// --- getInputAccessibilityHint ---

describe('getInputAccessibilityHint', () => {
  it('returns undefined when no options are provided', () => {
    expect(getInputAccessibilityHint()).toBeUndefined();
  });

  it('returns undefined when options is empty', () => {
    expect(getInputAccessibilityHint({})).toBeUndefined();
  });

  it('includes hint text when hint is provided', () => {
    expect(getInputAccessibilityHint({ hint: 'Enter your email' })).toBe('Enter your email');
  });

  it('includes max length info when maxLength is provided', () => {
    expect(getInputAccessibilityHint({ maxLength: 100 })).toBe('Maximum 100 characters');
  });

  it('includes both hint and max length when both provided', () => {
    expect(getInputAccessibilityHint({ hint: 'Enter your email', maxLength: 100 })).toBe(
      'Enter your email. Maximum 100 characters'
    );
  });
});

// --- getCharacterCountLabel ---

describe('getCharacterCountLabel', () => {
  it('returns count without max when max is not provided', () => {
    expect(getCharacterCountLabel(42)).toBe('42 characters');
  });

  it('returns "X of Y characters" when max is provided', () => {
    expect(getCharacterCountLabel(42, 100)).toBe('42 of 100 characters');
  });

  it('handles zero count', () => {
    expect(getCharacterCountLabel(0)).toBe('0 characters');
  });

  it('handles zero count with max', () => {
    expect(getCharacterCountLabel(0, 200)).toBe('0 of 200 characters');
  });
});

// --- getProgressAccessibilityLabel ---

describe('getProgressAccessibilityLabel', () => {
  it('returns percentage complete', () => {
    expect(getProgressAccessibilityLabel(75)).toBe('75% complete');
  });

  it('includes label when provided', () => {
    expect(getProgressAccessibilityLabel(75, 'Upload')).toBe('Upload: 75% complete');
  });

  it('rounds the percentage', () => {
    expect(getProgressAccessibilityLabel(33.7)).toBe('34% complete');
  });
});

// --- getStatusAccessibilityLabel ---

describe('getStatusAccessibilityLabel', () => {
  it('converts underscores to spaces', () => {
    expect(getStatusAccessibilityLabel('in_progress')).toBe('in progress');
  });

  it('includes label when provided', () => {
    expect(getStatusAccessibilityLabel('in_progress', 'Assessment')).toBe(
      'Assessment: in progress'
    );
  });

  it('returns status text as-is when no underscores', () => {
    expect(getStatusAccessibilityLabel('completed')).toBe('completed');
  });
});

// --- generateTestID ---

describe('generateTestID', () => {
  it('returns component type alone when no identifier or variant', () => {
    expect(generateTestID('Button')).toBe('button');
  });

  it('returns with identifier when provided', () => {
    expect(generateTestID('Button', 'submit')).toBe('button-submit');
  });

  it('returns with variant when provided', () => {
    expect(generateTestID('Button', 'submit', 'primary')).toBe('button-submit-primary');
  });

  it('lowercases and hyphenates spaces', () => {
    expect(generateTestID('Text Input', 'First Name', 'Large')).toBe(
      'text-input-first-name-large'
    );
  });
});

// --- ARIA_ROLES ---

describe('ARIA_ROLES', () => {
  it('has all 27 expected roles', () => {
    expect(Object.keys(ARIA_ROLES)).toHaveLength(27);
  });

  it('contains expected role keys', () => {
    const expectedKeys = [
      'button',
      'checkbox',
      'radio',
      'radiogroup',
      'textbox',
      'alert',
      'status',
      'progressbar',
      'link',
      'menu',
      'menuitem',
      'tab',
      'tablist',
      'tabpanel',
      'dialog',
      'alertdialog',
      'list',
      'listitem',
      'heading',
      'img',
      'form',
      'search',
      'navigation',
      'main',
      'banner',
      'complementary',
      'contentinfo',
    ];
    for (const key of expectedKeys) {
      expect(ARIA_ROLES).toHaveProperty(key);
    }
  });

  it('maps img key to "image" value', () => {
    expect(ARIA_ROLES.img).toBe('image');
  });
});

// --- LIVE_REGIONS ---

describe('LIVE_REGIONS', () => {
  it('has polite, assertive, and off', () => {
    expect(LIVE_REGIONS).toEqual({
      polite: 'polite',
      assertive: 'assertive',
      off: 'off',
    });
  });
});
