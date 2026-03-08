import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, ScaleQuestion, CurrencyQuestion } from '@/components/ui';
import type { ScaleValue, CurrencyValue } from '@/types/assessment';

export default function FraudResponseScreen() {
  const { assessment, updateAssessment } = useAssessment();

  return (
    <AssessmentScreen
      title="Fraud Response Plan"
      nextRoute="/action-plan"
      previousRoute="/monitoring-evaluation"
      hidePrevious={false}
      progress={{ current: 12, total: 13 }}
    >
      <CurrencyQuestion
        question="Estimated fraud losses detected in the past 3 years"
        hint="Total value of fraud incidents identified before completion"
        value={assessment.fraudResponsePlan.detectedLossesValue}
        onChange={(value) =>
          updateAssessment({ fraudResponsePlan: { ...assessment.fraudResponsePlan, detectedLossesValue: value } })
        }
      />

      <ScaleQuestion
        question="How quickly does the organisation typically respond to suspected fraud?"
        minLabel="Response is slow or reactive"
        maxLabel="Rapid, proactive response"
        value={assessment.fraudResponsePlan.responseSpeed}
        onChange={(value) =>
          updateAssessment({ fraudResponsePlan: { ...assessment.fraudResponsePlan, responseSpeed: value } })
        }
      />
    </AssessmentScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  intro: {
    fontSize: 16,
    color: colors.govGrey2,
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  timelineCard: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.govBlue,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.govBlue,
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.govRed,
    marginBottom: 4,
  },
  timelineDesc: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  card: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.warningOrange,
  },
  cardMargin: {
    marginTop: 12,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  phaseLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  phaseDays: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.warningOrange,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  phaseDesc: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  disciplinaryCard: {
    backgroundColor: '#fee',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.govRed,
  },
  disciplinaryItem: {
    fontSize: 14,
    color: colors.govGrey1,
    marginBottom: 8,
    fontWeight: '500' as const,
  },
  infoBox: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.govBlue,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.govBlue,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.govGrey1,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: colors.govGrey2,
    marginBottom: 12,
    fontStyle: 'italic' as const,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  nextButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },

});
