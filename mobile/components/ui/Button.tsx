import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius, Spacing, Fonts } from '../../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, icon, style, textStyle, fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.primary} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
  },
  primary: { backgroundColor: Colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: Colors.error },
  size_sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  size_md: { paddingHorizontal: Spacing.base, paddingVertical: 13 },
  size_lg: { paddingHorizontal: Spacing.xl, paddingVertical: 16 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: { fontWeight: '600' },
  text_primary: { color: '#fff' },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },
  text_danger: { color: '#fff' },
  textSize_sm: { fontSize: Fonts.sizes.sm },
  textSize_md: { fontSize: Fonts.sizes.base },
  textSize_lg: { fontSize: Fonts.sizes.md },
});
