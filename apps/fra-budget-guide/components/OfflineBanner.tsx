import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true);
    });
    return () => unsubscribe();
  }, []);

  if (isOnline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <WifiOff size={16} color={colors.warningDarker} />
      <Text style={styles.text}>You are offline. Changes will sync when reconnected.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: colors.warningDarker,
    fontWeight: '500',
  },
});
