import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrainingProgress } from '@/types/training';
import { useAuth } from '@/contexts/AuthContext';
import {
  type ProgressUpdate,
  type ServerProgress,
  isOffline,
  isPackageRequired,
  issueCertificate as requestCertificate,
  startProgress,
  updateProgress,
} from '@/services/workshop.service';
import { createLogger } from '@/utils/logger';
const logger = createLogger('TrainingContext');

const STORAGE_KEY = 'training_progress';
const TOTAL_SECTIONS = 7;

/**
 * Whether this user may take the workshop, as the server sees it.
 * - checking: not asked yet
 * - granted: the organisation holds Health Check + Training or Full Dashboard
 * - locked: the organisation has no package that includes the workshop
 * - offline: the server could not be reached; progress is kept on the phone and sent later
 * - signed-out: no account yet
 */
export type TrainingAccess = 'checking' | 'granted' | 'locked' | 'offline' | 'signed-out';

export type CertificateResult =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'locked' | 'not-completed' | 'quiz-not-passed' | 'error'; message?: string };

const defaultProgress: TrainingProgress = {
  completedSections: [],
  quizScores: {},
  scenarioChoices: {},
  actionPlanCommitments: {
    immediate: [],
    thirtyDays: [],
    ninetyDays: [],
  },
  currentSection: 0,
  completedAt: null,
  certificateNumber: null,
  certificateIssuedAt: null,
  pendingQuizAnswers: {},
  serverProgressId: null,
};

const sameNumbers = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const sameRecord = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** Older versions made up a certificate number on the phone; only certificates the server issued are kept. */
function fromStorage(raw: string): TrainingProgress {
  const stored = { ...defaultProgress, ...JSON.parse(raw) } as TrainingProgress;
  if (stored.certificateNumber && !stored.certificateIssuedAt) {
    return { ...stored, certificateNumber: null };
  }
  return stored;
}

/** Combine the phone's progress with the server's: the server decides scores and completion. */
function mergeServer(local: TrainingProgress, row: ServerProgress): TrainingProgress {
  return {
    ...local,
    serverProgressId: row.id,
    completedSections: [...new Set([...(row.completed_sections ?? []), ...local.completedSections])].sort((a, b) => a - b),
    quizScores: Object.fromEntries(Object.entries(row.quiz_scores ?? {}).map(([k, v]) => [Number(k), v])),
    scenarioChoices: { ...(row.scenario_choices ?? {}), ...local.scenarioChoices },
    currentSection: Math.max(local.currentSection, row.current_section ?? 0),
    completedAt: row.completed_at ?? local.completedAt,
  };
}

export const [TrainingProvider, useTraining] = createContextHook(() => {
  const { isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<TrainingProgress>(defaultProgress);
  const [isLoading, setIsLoading] = useState(true);
  const [access, setAccess] = useState<TrainingAccess>('checking');

  // Latest progress for the sync, which runs outside React's render cycle
  const progressRef = useRef<TrainingProgress>(defaultProgress);
  // Syncs run one at a time, in order
  const syncChain = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: TrainingProgress) => {
    progressRef.current = next;
    setProgress(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error: unknown) => {
      logger.error('Failed to save training progress', error);
    });
  }, []);

  const update = useCallback(
    (updater: (prev: TrainingProgress) => TrainingProgress) => commit(updater(progressRef.current)),
    [commit]
  );

  /** Sends what the phone knows to the server and takes back the server's view. */
  const runSync = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) {
      setAccess('signed-out');
      return;
    }

    // Fetches the progress record, or creates it on first use
    const started = await startProgress();
    if (isPackageRequired(started)) {
      setAccess('locked');
      return;
    }
    if (!started.success || !started.data) {
      if (!isOffline(started)) logger.error('Could not load workshop progress', started.error);
      setAccess('offline');
      return;
    }
    let row: ServerProgress = started.data;

    const changes: ProgressUpdate = {};
    const merged = mergeServer(progressRef.current, row);
    if (!sameNumbers(merged.completedSections, [...(row.completed_sections ?? [])].sort((a, b) => a - b))) {
      changes.completedSections = merged.completedSections;
    }
    if (merged.currentSection !== row.current_section) changes.currentSection = merged.currentSection;
    if (!sameRecord(merged.scenarioChoices, row.scenario_choices ?? {})) changes.scenarioChoices = merged.scenarioChoices;
    const pending = progressRef.current.pendingQuizAnswers;
    if (Object.keys(pending).length) changes.quizAnswers = pending;

    if (Object.keys(changes).length) {
      const res = await updateProgress(row.id, changes);
      if (isPackageRequired(res)) {
        setAccess('locked');
        return;
      }
      if (!res.success || !res.data) {
        if (!isOffline(res)) logger.error('Could not save workshop progress', res.error);
        setAccess('offline');
        return;
      }
      row = res.data;
    }

    // Answers the server has now marked are no longer pending
    const sent = changes.quizAnswers ?? {};
    const stillPending = Object.fromEntries(
      Object.entries(progressRef.current.pendingQuizAnswers).filter(([k, v]) => sent[k] !== v)
    );
    commit({ ...mergeServer(progressRef.current, row), pendingQuizAnswers: stillPending });
    setAccess('granted');
  }, [isAuthenticated, commit]);

  const sync = useCallback((): Promise<void> => {
    const next = syncChain.current.then(runSync).catch((error: unknown) => {
      logger.error('Workshop sync failed', error);
      setAccess('offline');
    });
    syncChain.current = next;
    return next;
  }, [runSync]);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) commit(fromStorage(stored));
      } catch (error: unknown) {
        logger.error('Failed to load training progress', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [commit]);

  // Bring the server up to date whenever the user signs in (and after loading from the phone)
  useEffect(() => {
    if (!isLoading) sync();
  }, [isLoading, isAuthenticated, sync]);

  const completeSection = useCallback(
    async (sectionId: number) => {
      update((prev) =>
        prev.completedSections.includes(sectionId)
          ? prev
          : { ...prev, completedSections: [...prev.completedSections, sectionId].sort((a, b) => a - b) }
      );
      await sync();
    },
    [update, sync]
  );

  /**
   * Records the option the user chose. The phone shows right or wrong straight away;
   * the server marks it for the record (kept as pending until it has).
   */
  const saveQuizAnswer = useCallback(
    async (sectionId: number, answerIndex: number, isCorrect: boolean) => {
      update((prev) => ({
        ...prev,
        quizScores: { ...prev.quizScores, [sectionId]: isCorrect ? 100 : 0 },
        pendingQuizAnswers: { ...prev.pendingQuizAnswers, [String(sectionId)]: answerIndex },
      }));
      await sync();
    },
    [update, sync]
  );

  const saveScenarioChoice = useCallback(
    async (stepId: string, choiceId: string) => {
      update((prev) => ({ ...prev, scenarioChoices: { ...prev.scenarioChoices, [stepId]: choiceId } }));
      await sync();
    },
    [update, sync]
  );

  const saveActionPlan = useCallback(
    async (commitments: { immediate: string[]; thirtyDays: string[]; ninetyDays: string[] }) => {
      update((prev) => ({ ...prev, actionPlanCommitments: commitments }));
    },
    [update]
  );

  const setCurrentSection = useCallback(
    async (sectionId: number) => {
      update((prev) => ({ ...prev, currentSection: sectionId }));
    },
    [update]
  );

  /**
   * Asks the server to record the workshop as complete and issue the certificate.
   * The server checks every section and quiz is done, so this only succeeds for real training.
   */
  const issueCertificate = useCallback(async (): Promise<CertificateResult> => {
    await sync();
    const id = progressRef.current.serverProgressId;
    if (!id) return { ok: false, reason: 'offline' };

    if (!progressRef.current.completedAt) {
      const done = await updateProgress(id, { completedAt: new Date().toISOString() });
      if (isPackageRequired(done)) return { ok: false, reason: 'locked' };
      if (done.error?.code === 'NOT_COMPLETED') return { ok: false, reason: 'not-completed', message: done.error.message };
      // Every question answered, but under the 80% pass mark: the missed questions must be answered again
      if (done.error?.code === 'QUIZ_NOT_PASSED') return { ok: false, reason: 'quiz-not-passed', message: done.error.message };
      if (!done.success || !done.data) return { ok: false, reason: isOffline(done) ? 'offline' : 'error' };
      commit(mergeServer(progressRef.current, done.data));
    }

    const cert = await requestCertificate();
    if (isPackageRequired(cert)) return { ok: false, reason: 'locked' };
    if (!cert.success || !cert.data) return { ok: false, reason: isOffline(cert) ? 'offline' : 'error' };
    update((prev) => ({
      ...prev,
      certificateNumber: cert.data!.certificate_number,
      certificateIssuedAt: cert.data!.issued_at,
    }));
    return { ok: true };
  }, [sync, commit, update]);

  const resetProgress = useCallback(async () => {
    commit(defaultProgress);
  }, [commit]);

  const isComplete = useMemo(
    () => progress.completedSections.length >= TOTAL_SECTIONS,
    [progress.completedSections]
  );

  return {
    ...progress,
    isLoading,
    isComplete,
    access,
    hasPendingSync: Object.keys(progress.pendingQuizAnswers).length > 0,
    sync,
    completeSection,
    saveQuizAnswer,
    saveScenarioChoice,
    saveActionPlan,
    setCurrentSection,
    issueCertificate,
    resetProgress,
  };
});
