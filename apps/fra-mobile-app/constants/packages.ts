import type { PackageType } from '@/types/assessment';

// Single source for package names, prices and features in the mobile app.
// Mirrors the backend catalogue (apps/fra-backend/backend/src/types.ts, FALLBACK_PACKAGES)
// and the web app (apps/fra-web-dashboard/src/data/packages.ts); prices exclude VAT.

export interface CataloguePackage {
  /** Package id used by the backend purchase API. */
  backendId: 'pkg_basic' | 'pkg_training' | 'pkg_full';
  name: 'Starter' | 'Professional' | 'Enterprise';
  badge: string;
  priceGbp: number;
  billing: 'one-time' | 'annual';
  tagline: string;
  features: string[];
  keyPasses: number | 'unlimited';
  audience: string;
}

export const PACKAGES: Record<PackageType, CataloguePackage> = {
  'health-check': {
    backendId: 'pkg_basic',
    name: 'Starter',
    badge: 'PACKAGE 1',
    priceGbp: 795,
    billing: 'one-time',
    tagline: 'One-off fraud risk health check',
    features: [
      'Single fraud risk assessment across 13 key areas',
      'Downloadable PDF health check report',
      'ECCTA 2023 compliance snapshot',
      '1 key-pass included',
    ],
    keyPasses: 1,
    audience: 'Sole traders and micro-businesses',
  },
  'with-awareness': {
    backendId: 'pkg_training',
    name: 'Professional',
    badge: 'PACKAGE 2',
    priceGbp: 1799,
    billing: 'annual',
    tagline: 'Assessment + staff training',
    features: [
      'Everything in Starter',
      'Staff awareness training with certificates',
      'Up to 50 employee key-passes',
      'Quarterly reassessment',
      'Email support',
    ],
    keyPasses: 50,
    audience: 'SMEs (10–100 employees)',
  },
  'with-dashboard': {
    backendId: 'pkg_full',
    name: 'Enterprise',
    badge: 'PACKAGE 3',
    priceGbp: 4995,
    billing: 'annual',
    tagline: 'Full dashboard + unlimited staff',
    features: [
      'Everything in Professional',
      'Real-time monitoring dashboard',
      'Unlimited employee key-passes',
      'Risk register & action tracking',
      'API access',
      'Priority support',
      'GovS-013 & ECCTA compliance reports',
    ],
    keyPasses: 'unlimited',
    audience: 'Large organisations (100+ employees)',
  },
};

/** "£1,799" */
export const formatGbp = (amount: number) => `£${amount.toLocaleString('en-GB')}`;

/** Price suffix shown beside the amount, e.g. "one-time + VAT" or "/year + VAT". */
export const billingNote = (pkg: CataloguePackage) => (pkg.billing === 'one-time' ? 'one-time + VAT' : '/year + VAT');

/** Spoken price for screen readers, e.g. "795 pounds one-time plus VAT". */
export const spokenPrice = (pkg: CataloguePackage) =>
  `${pkg.priceGbp} pounds ${pkg.billing === 'one-time' ? 'one-time' : 'per year'} plus VAT`;
