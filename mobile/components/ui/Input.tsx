import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Fonts } from '../../constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({ label, error, leftIcon, rightIcon, containerStyle, isPassword, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, error ? styles.errorBorder : styles.normalBorder]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, leftIcon ? styles.inputPaddingLeft : null]}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.iconRight}>
            <Text style={styles.showHide}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: Fonts.sizes.sm, fontWeight: '500', color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  normalBorder: { borderColor: Colors.border },
  errorBorder: { borderColor: Colors.error },
  input: { flex: 1, fontSize: Fonts.sizes.base, color: Colors.textPrimary },
  inputPaddingLeft: { paddingLeft: Spacing.sm },
  iconLeft: { marginRight: Spacing.sm },
  iconRight: { marginLeft: Spacing.sm },
  error: { fontSize: Fonts.sizes.xs, color: Colors.error },
  showHide: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '600' },
});
