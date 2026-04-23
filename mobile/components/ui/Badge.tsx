import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Fonts } from '../../constants/colors';

type BadgeVariant = 'success' | 'warning' | 'error' | 'primary' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: Colors.successLight, text: Colors.successText },
  warning: { bg: Colors.warningLight, text: '#92400E' },
  error: { bg: Colors.errorLight, text: Colors.error },
  primary: { bg: Colors.primaryLight, text: Colors.primaryDark },
  neutral: { bg: Colors.surfaceAlt, text: Colors.textSecondary },
};

export function Badge({ label, variant = 'neutral', style, icon }: BadgeProps) {
  const vs = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: vs.bg }, style]}>
      {icon}
      <Text style={[styles.text, { color: vs.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  text: { fontSize: Fonts.sizes.xs, fontWeight: '600' },
});
