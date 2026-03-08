import { useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function FraudBasicsScreen() {
  const router = useRouter();

  return (
    <ScreenContainer screenId="fraud-basics">
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <AlertTriangle color={colors.warning} size={48} />
        </View>
        <Text style={styles.title}>How Fraud Really Happens</Text>
        <Text style={styles.subtitle}>The Fraud Triangle</Text>
      </View>

      <View style={styles.triangleContainer}>
        <View style={styles.triangleVisual}>
          <View style={styles.triangleTop}>
            <View style={styles.triangleNode}>
              <Text style={styles.triangleNodeLabel}>PRESSURE</Text>
              <Text style={styles.triangleNodeText}>Financial stress{'\n'}Unrealistic targets</Text>
            </View>
          </View>
          <View style={styles.triangleBottom}>
            <View style={[styles.triangleNode, styles.triangleNodeHighlight]}>
              <Text style={[styles.triangleNodeLabel, styles.triangleNodeLabelHighlight]}>
                OPPORTUNITY
              </Text>
              <Text style={[styles.triangleNodeText, styles.triangleNodeTextHighlight]}>
                Weak controls{'\n'}Lack of oversight
              </Text>
            </View>
            <View style={styles.triangleNode}>
              <Text style={styles.triangleNodeLabel}>RATIONALIZATION</Text>
              <Text style={styles.triangleNodeText}>Everyone does it{'\n'}I deserve this</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>Your Control Point</Text>
        <Text style={styles.insightText}>
          You cannot control employee financial pressures or their ability to rationalize.
        </Text>
        <Text style={[styles.insightText, styles.insightTextBold]}>
          But you CAN remove opportunities through robust controls.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Fraud occurs when three elements align:</Text>
        <View style={styles.infoList}>
          <View style={styles.infoItem}>
            <View style={styles.bullet} />
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Pressure:</Text> Financial difficulties, unrealistic performance targets, or personal problems
            </Text>
          </View>
          <View style={styles.infoItem}>
            <View style={[styles.bullet, styles.bulletHighlight]} />
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Opportunity:</Text> Weak internal controls, lack of oversight, or trust without verification
            </Text>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.bullet} />
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Rationalization:</Text> Justifying dishonest behavior through mental gymnastics
            </Text>
          </View>
        </View>
      </View>

      <ActionButton
        label="View Fraud Scenarios"
        onPress={() => router.push('/scenarios')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  triangleContainer: {
    marginBottom: spacing.lg,
  },
  triangleVisual: {
    paddingVertical: 20,
  },
  triangleTop: {
    alignItems: 'center',
    marginBottom: 40,
  },
  triangleBottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  triangleNode: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    width: 160,
    alignItems: 'center',
  },
  triangleNodeHighlight: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLighter,
  },
  triangleNodeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  triangleNodeLabelHighlight: {
    color: colors.warning,
  },
  triangleNodeText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  triangleNodeTextHighlight: {
    color: colors.warningDark,
  },
  insightCard: {
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    padding: 20,
    marginBottom: spacing.lg,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
    marginBottom: 12,
    textAlign: 'center',
  },
  insightText: {
    fontSize: 15,
    color: colors.surface,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  insightTextBold: {
    fontWeight: '700',
    marginBottom: 0,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoList: {
    gap: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: spacing.xs,
    backgroundColor: colors.textFaint,
    marginTop: 6,
    marginRight: 12,
  },
  bulletHighlight: {
    backgroundColor: colors.warning,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: colors.text,
  },
});
