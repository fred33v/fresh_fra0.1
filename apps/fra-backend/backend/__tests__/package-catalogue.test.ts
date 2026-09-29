/// <reference types="jest" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { FALLBACK_PACKAGES } from '../src/types';
import { PACKAGES as WEB_CATALOGUE } from '../../../fra-web-dashboard/src/data/packages';

// Package prices, allowances and features are defined in three places.
// These tests fail if any of them drift apart.

describe('Package definitions stay in sync', () => {
  it('web catalogue matches the backend packages', () => {
    for (const backend of FALLBACK_PACKAGES) {
      const web = WEB_CATALOGUE.find((p) => p.id === backend.id);
      expect(web).toBeDefined();
      expect(web!.name).toBe(backend.name);
      expect(web!.priceGbp * 100).toBe(backend.priceCents);
      expect(web!.keypassAllowance).toBe(backend.keypassAllowance);
      expect(web!.features).toEqual(backend.features);
    }
    expect(WEB_CATALOGUE).toHaveLength(FALLBACK_PACKAGES.length);
  });

  it('the latest database seed matches the backend packages', () => {
    const migrationsDir = join(__dirname, '..', 'migrations');
    const seed = readFileSync(join(migrationsDir, '018_sync_package_features.sql'), 'utf8');
    for (const pkg of FALLBACK_PACKAGES) {
      expect(seed).toContain(`'${pkg.id}'`);
      expect(seed).toContain(`price_cents = ${pkg.priceCents}`);
      expect(seed).toContain(`'${JSON.stringify(pkg.features)}'::jsonb`);
    }
  });
});
