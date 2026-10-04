// Speak-up storage: Postgres when DATABASE_URL is set, in-memory otherwise (tests, local dev).

import { hasDatabase } from './helpers.js';
import { speakUpIntakeByOrg, speakUpMessages, speakUpReportsById } from './stores.js';
import {
  dbGetIntakeByOrg, dbGetIntakeByToken, dbGetReport, dbGetReportByReference, dbInsertMessage, dbInsertReport,
  dbListMessages, dbListReports, dbTouchReport, dbUpdateReport, dbUpsertIntake,
} from './db/speak-up.js';
import type { SpeakUpIntake, SpeakUpMessage, SpeakUpReport } from './speak-up.js';

export async function getIntakeByOrg(orgId: string): Promise<SpeakUpIntake | null> {
  return hasDatabase() ? dbGetIntakeByOrg(orgId) : speakUpIntakeByOrg.get(orgId) ?? null;
}

export async function getIntakeByToken(token: string): Promise<SpeakUpIntake | null> {
  if (hasDatabase()) return dbGetIntakeByToken(token);
  return Array.from(speakUpIntakeByOrg.values()).find((i) => i.token === token) ?? null;
}

export async function saveIntake(intake: SpeakUpIntake): Promise<void> {
  if (hasDatabase()) await dbUpsertIntake(intake);
  else speakUpIntakeByOrg.set(intake.organisationId, intake);
}

export async function listReports(orgId: string): Promise<SpeakUpReport[]> {
  if (hasDatabase()) return dbListReports(orgId);
  return Array.from(speakUpReportsById.values())
    .filter((r) => r.organisationId === orgId)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function getReport(id: string, orgId: string): Promise<SpeakUpReport | null> {
  if (hasDatabase()) return dbGetReport(id, orgId);
  const r = speakUpReportsById.get(id);
  return r && r.organisationId === orgId ? r : null;
}

export async function getReportByReference(reference: string): Promise<SpeakUpReport | null> {
  if (hasDatabase()) return dbGetReportByReference(reference);
  return Array.from(speakUpReportsById.values()).find((r) => r.reference === reference) ?? null;
}

export async function insertReport(r: SpeakUpReport): Promise<void> {
  if (hasDatabase()) await dbInsertReport(r);
  else speakUpReportsById.set(r.id, r);
}

export async function updateReport(r: SpeakUpReport): Promise<void> {
  if (hasDatabase()) await dbUpdateReport(r);
  else speakUpReportsById.set(r.id, r);
}

export async function listMessages(reportId: string): Promise<SpeakUpMessage[]> {
  if (hasDatabase()) return dbListMessages(reportId);
  return speakUpMessages.filter((m) => m.reportId === reportId);
}

export async function addMessage(m: SpeakUpMessage): Promise<void> {
  if (hasDatabase()) {
    await dbInsertMessage(m);
    await dbTouchReport(m.reportId, m.createdAt);
  } else {
    speakUpMessages.push(m);
    const r = speakUpReportsById.get(m.reportId);
    if (r) r.updatedAt = m.createdAt;
  }
}
