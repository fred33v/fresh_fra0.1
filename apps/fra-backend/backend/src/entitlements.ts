// ============================================================
// Package entitlements — what each paid package unlocks
// Pure date/tier logic lives in helpers.ts; this module adds data access.
// ============================================================

import type { Context } from 'hono';
import type { Assessment, Purchase } from './types.js';
import { FALLBACK_PACKAGES } from './types.js';
import {
  type AuthContext, PACKAGE_TIER, getActiveTier, getActiveWindows, getPackageExpiry,
  hasDatabase, hasPackageEntitlement, jsonError,
} from './helpers.js';
import { assessmentsById, purchasesById } from './stores.js';
import { dbGetPackageById, dbListAssessmentsByOrganisation, dbListPurchasesByOrganisation } from './db/index.js';

// Professional includes quarterly reassessment: 4 assessments per person per subscription year
export const PROFESSIONAL_ASSESSMENTS_PER_TERM = 4;

const PACKAGE_NAMES: Record<string, string> = {
  pkg_basic: 'Starter',
  pkg_training: 'Professional',
  pkg_full: 'Enterprise',
};

export async function listOrgPurchases(orgId: string): Promise<Purchase[]> {
  return hasDatabase()
    ? dbListPurchasesByOrganisation(orgId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === orgId);
}

async function listOrgAssessments(orgId: string): Promise<Assessment[]> {
  return hasDatabase()
    ? dbListAssessmentsByOrganisation(orgId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === orgId);
}

/** Returns a 403 PACKAGE_REQUIRED response when the org lacks the package, otherwise null. */
export async function requirePackage(c: Context, auth: AuthContext, packageId: string): Promise<Response | null> {
  const purchases = await listOrgPurchases(auth.organisationId);
  if (hasPackageEntitlement(purchases, packageId)) return null;
  return jsonError(c, 403, 'PACKAGE_REQUIRED', `${PACKAGE_NAMES[packageId] ?? packageId} package or higher required`);
}

/** Returns a 403 PACKAGE_REQUIRED response unless the org has ever paid for any package. */
export async function requireAnyPaidPurchase(c: Context, auth: AuthContext): Promise<Response | null> {
  const purchases = await listOrgPurchases(auth.organisationId);
  if (purchases.some((p) => p.status === 'succeeded')) return null;
  return jsonError(c, 403, 'PACKAGE_REQUIRED', 'A paid package is required');
}

/** Key-pass allowance from the org's active packages; -1 means unlimited, 0 means none. */
export async function getActiveKeypassAllowance(purchases: Purchase[]): Promise<number> {
  let allowance = 0;
  for (const w of getActiveWindows(purchases)) {
    const pkg = hasDatabase()
      ? await dbGetPackageById(w.purchase.packageId)
      : FALLBACK_PACKAGES.find((fp) => fp.id === w.purchase.packageId) ?? null;
    if (!pkg) continue;
    if (pkg.keypassAllowance < 0) return -1;
    if (pkg.keypassAllowance > allowance) allowance = pkg.keypassAllowance;
  }
  return allowance;
}

export type AssessmentAllowance = {
  allowed: boolean;
  limit: number | null; // null = unlimited
  used: number;
  reason?: string;
};

/**
 * How many assessments this user may still start under the org's package:
 * - Starter: one assessment for the whole organisation
 * - Professional: 4 per person per subscription year (quarterly reassessment)
 * - Enterprise: unlimited (continuous reassessment)
 */
export async function getAssessmentAllowance(auth: AuthContext, now: Date = new Date()): Promise<AssessmentAllowance> {
  const purchases = await listOrgPurchases(auth.organisationId);
  const tier = getActiveTier(purchases, now);

  if (tier === 0) return { allowed: false, limit: 0, used: 0, reason: 'No active package' };
  if (tier >= PACKAGE_TIER.pkg_full) return { allowed: true, limit: null, used: 0 };

  const assessments = await listOrgAssessments(auth.organisationId);

  if (tier === PACKAGE_TIER.pkg_basic) {
    const limit = purchases.filter((p) => p.status === 'succeeded' && p.packageId === 'pkg_basic').length;
    const used = assessments.length;
    return used < limit
      ? { allowed: true, limit, used }
      : { allowed: false, limit, used, reason: 'Starter includes a single assessment — upgrade to Professional for quarterly reassessment' };
  }

  const termStart = getActiveWindows(purchases, now)
    .filter((w) => w.purchase.packageId === 'pkg_training')
    .reduce((earliest, w) => Math.min(earliest, w.startsAt.getTime()), now.getTime());
  const used = assessments.filter(
    (a) => a.createdByUserId === auth.userId && new Date(a.createdAt).getTime() >= termStart
  ).length;
  const limit = PROFESSIONAL_ASSESSMENTS_PER_TERM;
  return used < limit
    ? { allowed: true, limit, used }
    : { allowed: false, limit, used, reason: 'Professional includes 4 assessments per person per year' };
}

/** Summary served to the frontend so it can show or hide package features. */
export async function getEntitlementSummary(auth: AuthContext) {
  const purchases = await listOrgPurchases(auth.organisationId);
  const tier = getActiveTier(purchases);
  const currentPackageId = Object.keys(PACKAGE_TIER).find((id) => PACKAGE_TIER[id] === tier) ?? null;
  const expiry = currentPackageId ? getPackageExpiry(purchases, currentPackageId) : undefined;
  const assessments = await getAssessmentAllowance(auth);
  const keypassAllowance = await getActiveKeypassAllowance(purchases);

  return {
    packageId: currentPackageId,
    packageName: currentPackageId ? PACKAGE_NAMES[currentPackageId] : null,
    tier,
    expiresAt: expiry ? expiry.toISOString() : null,
    features: {
      assessment: tier >= PACKAGE_TIER.pkg_basic,
      training: tier >= PACKAGE_TIER.pkg_training,
      certificates: tier >= PACKAGE_TIER.pkg_training,
      dashboard: tier >= PACKAGE_TIER.pkg_full,
      compliance: tier >= PACKAGE_TIER.pkg_full,
    },
    keypassAllowance,
    assessments,
  };
}
