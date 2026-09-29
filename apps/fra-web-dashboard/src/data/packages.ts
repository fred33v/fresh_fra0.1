// ============================================================
// Package catalogue for the web app — the one place prices, audiences and
// headline features are defined for the landing, package and checkout pages.
//
// Must match the backend (FALLBACK_PACKAGES in apps/fra-backend/backend/src/types.ts
// and the packages table). A backend test imports this file and fails on drift,
// so keep it free of imports.
// ============================================================

export type PackageId = 'pkg_basic' | 'pkg_training' | 'pkg_full';
export type PackageName = 'Starter' | 'Professional' | 'Enterprise';

export interface CataloguePackage {
  id: PackageId;
  name: PackageName;
  slug: 'starter' | 'professional' | 'enterprise';
  priceGbp: number;
  billing: 'one-time' | 'annual';
  keypassAllowance: number; // -1 = unlimited
  audience: string;
  tagline: string;
  features: string[];
}

export const PACKAGES: CataloguePackage[] = [
  {
    id: 'pkg_basic',
    name: 'Starter',
    slug: 'starter',
    priceGbp: 795,
    billing: 'one-time',
    keypassAllowance: 1,
    audience: 'Sole traders and micro-businesses',
    tagline: 'Ideal for a one-time fraud risk health-check',
    features: [
      'Single fraud risk assessment across 13 key areas',
      'Downloadable PDF health check report',
      'ECCTA 2023 compliance snapshot',
      '1 key-pass included',
    ],
  },
  {
    id: 'pkg_training',
    name: 'Professional',
    slug: 'professional',
    priceGbp: 1799,
    billing: 'annual',
    keypassAllowance: 50,
    audience: 'SMEs, charities and public-sector teams with 10–100 employees',
    tagline: 'Ongoing protection with training & support',
    features: [
      'Everything in Starter',
      '50 employee key-passes',
      'Staff awareness training with certificates',
      'Quarterly reassessment',
      'Email support',
    ],
  },
  {
    id: 'pkg_full',
    name: 'Enterprise',
    slug: 'enterprise',
    priceGbp: 4995,
    billing: 'annual',
    keypassAllowance: -1,
    audience: 'Organisations with 100+ employees',
    tagline: 'Full-scale fraud risk management for large organisations',
    features: [
      'Everything in Professional',
      'Unlimited employee key-passes',
      'Real-time monitoring dashboard',
      'Risk register and action tracking',
      'API access',
      'Priority support',
      'Compliance reports',
    ],
  },
];

export function getPackage(idOrName: string): CataloguePackage | undefined {
  return PACKAGES.find((p) => p.id === idOrName || p.name === idOrName || p.slug === idOrName);
}

/** "£1,799" */
export function formatPrice(pkg: CataloguePackage): string {
  return `£${pkg.priceGbp.toLocaleString('en-GB')}`;
}

/** "one-time" or "/year" */
export function billingLabel(pkg: CataloguePackage): string {
  return pkg.billing === 'one-time' ? 'one-time' : '/year';
}

export function checkoutPath(pkg: CataloguePackage): string {
  return `/checkout?package=${pkg.name}`;
}
