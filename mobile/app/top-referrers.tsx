import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../constants/colors';
import { referralsApi } from '../services/api';
import { LeaderboardEntry } from '../types';

type Period = 'weekly' | 'monthly' | 'all-time';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'All Time', value: 'all-time' },
];

function PodiumUser({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) {
  const sizes = { 1: 72, 2: 56, 3: 56 };
  const marginTop = position === 1 ? 0 : 24;
  const rankColors: Record<number, string> = { 1: Colors.gold, 2: '#9CA3AF', 3: '#CD7F32' };

  return (
    <View style={[styles.podiumUser, { marginTop }]}>
      {position === 1 && <Text style={styles.crown}>👑</Text>}
      <View style={[styles.podiumAvatar, { width: sizes[position], height: sizes[position], borderRadius: sizes[position] / 2, borderColor: rankColors[position] }]}>
        <Text style={[styles.podiumAvatarText, { fontSize: position === 1 ? 28 : 22 }]}>
          {entry.username?.[0]?.toUpperCase() ?? 'G'}
        </Text>
      </View>
      <View style={[styles.rankBadge, { backgroundColor: rankColors[position] }]}>
        <Text style={styles.rankBadgeText}>{position}</Text>
      </View>
      <Text style={styles.podiumUsername} numberOfLines={1}>{entry.username}</Text>
      <Text style={styles.podiumId}>ID: {entry.userId}</Text>
    </View>
  );
}

export default function TopReferrersScreen() {
  const [period, setPeriod] = useState<Period>('all-time');

  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ['referrals', 'leaderboard', period],
    queryFn: () => referralsApi.getLeaderboard(period).then((r) => r.data.data),
  });

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Top Referrers</Text>

      {/* Period Tabs */}
      <View style={styles.periodTabs}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodTab, period === p.value && styles.periodTabActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodTabText, period === p.value && styles.periodTabTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={rest}
        keyExtractor={(e) => e.userId}
        ListHeaderComponent={
          /* Podium */
          top3.length >= 3 ? (
            <View style={styles.podium}>
              <PodiumUser entry={top3[1]} position={2} />
              <PodiumUser entry={top3[0]} position={1} />
              <PodiumUser entry={top3[2]} position={3} />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rowRank}>{index + 4}.</Text>
            <View style={styles.rowAvatar}>
              <Text style={styles.rowAvatarText}>{item.username?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.username} {item.isVerified ? '✓' : ''}</Text>
              <Text style={styles.rowId}>ID: {item.userId}</Text>
            </View>
            <Text style={styles.rowCount}>{item.invitedUsers}</Text>
          </View>
        )}
        ListHeaderComponentStyle={styles.listHeaderStyle}
        stickyHeaderIndices={[]}
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { padding: Spacing.base },
  backBtn: {},
  backArrow: { fontSize: Fonts.sizes.base, color: Colors.textPrimary, fontWeight: '600' },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.lg },

  periodTabs: { flexDirection: 'row', marginHorizontal: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.full, padding: 4, marginBottom: Spacing.xl },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.full },
  periodTabActive: { backgroundColor: Colors.primary },
  periodTabText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textSecondary },
  periodTabTextActive: { color: '#fff' },

  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: Spacing.xl, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.base },
  podiumUser: { alignItems: 'center', gap: 4, flex: 1 },
  crown: { fontSize: 28, marginBottom: 4 },
  podiumAvatar: { borderWidth: 3, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  podiumAvatarText: { fontWeight: '700', color: Colors.primary },
  rankBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
  rankBadgeText: { fontSize: Fonts.sizes.xs, fontWeight: '800', color: '#fff' },
  podiumUsername: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  podiumId: { fontSize: Fonts.sizes.xs, color: Colors.textMuted, textAlign: 'center' },

  listHeaderStyle: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderBottomWidth: 1, borderColor: Colors.border },
  rowRank: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary, width: 28 },
  rowAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rowAvatarText: { fontWeight: '700', color: Colors.primary },
  rowInfo: { flex: 1 },
  rowName: { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.textPrimary },
  rowId: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  rowCount: { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.textPrimary },
});
