import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Fonts } from '../../constants/colors';

interface ProgressBarProps {
  value: number;
  max: number;
  showLabel?: boolean;
  label?: string;
  height?: number;
  color?: string;
}

export function ProgressBar({ value, max, showLabel = true, label, height = 8, color = Colors.primary }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, height }]} />
        {showLabel && (
          <Text style={styles.labelInside}>{Math.round(pct)}%</Text>
        )}
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  track: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fill: { position: 'absolute', left: 0, borderRadius: Radius.full },
  labelInside: { fontSize: Fonts.sizes.xs, color: '#fff', fontWeight: '700', paddingRight: 6, zIndex: 1 },
  label: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
});
