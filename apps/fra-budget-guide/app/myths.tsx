import { useRouter } from 'expo-router';
import { RotateCcw, CheckCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { myths } from '@/constants/data/myths';

export default function MythsScreen() {
  const router = useRouter();
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const handleFlip = (id: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <ScreenContainer screenId="myths">
      <View style={styles.header}>
        <RotateCcw color={colors.warning} size={40} />
        <Text style={styles.title}>Common Fraud Myths</Text>
        <Text style={styles.subtitle}>Tap any card to reveal the reality</Text>
      </View>

      <View style={styles.cardsContainer}>
        {myths.map((myth) => {
          const isFlipped = flippedCards[myth.id];

          return (
            <TouchableOpacity
              key={myth.id}
              style={styles.cardWrapper}
              onPress={() => handleFlip(myth.id)}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={
                isFlipped
                  ? `Reality: ${myth.reality}. Tap to see myth`
                  : `Myth: ${myth.myth}. Tap to see reality`
              }
            >
              <View style={[styles.card, isFlipped && styles.cardFlipped]}>
                {!isFlipped ? (
                  <View style={styles.cardFront}>
                    <View style={styles.mythBadge}>
                      <Text style={styles.mythBadgeText}>MYTH</Text>
                    </View>
                    <Text style={styles.mythText}>{myth.myth}</Text>
                    <Text style={styles.tapHint}>Tap to see reality</Text>
                  </View>
                ) : (
                  <View style={styles.cardBack}>
                    <View style={styles.realityBadge}>
                      <CheckCircle color={colors.surface} size={20} />
                      <Text style={styles.realityBadgeText}>REALITY</Text>
                    </View>
                    <Text style={styles.realityText}>{myth.reality}</Text>
                    <Text style={styles.tapHint}>Tap to see myth</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.noteCardWrapper}>
        <InfoBanner
          message="Remove complacency and false confidence by understanding these common misconceptions."
          variant="warning"
        />
      </View>

      <ActionButton
        label="Take Your Pledge"
        onPress={() => router.push('/pledge')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md - 4,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardWrapper: {
    minHeight: 200,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minHeight: 200,
    justifyContent: 'center',
    ...shadows.md,
  },
  cardFlipped: {
    backgroundColor: colors.success,
  },
  cardFront: {
    alignItems: 'center',
  },
  cardBack: {
    alignItems: 'center',
  },
  mythBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  mythBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: 1,
  },
  mythText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.md - 4,
  },
  realityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  realityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: 1,
  },
  realityText: {
    fontSize: 16,
    color: colors.surface,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.md - 4,
  },
  tapHint: {
    fontSize: 13,
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  noteCardWrapper: {
    marginBottom: spacing.lg,
  },
});
