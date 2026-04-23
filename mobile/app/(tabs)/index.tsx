import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Dimensions, RefreshControl, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { propertiesApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { Property } from '../../types';

const { width } = Dimensions.get('window');

function formatIDR(val: number) {
  return `IDR ${val.toLocaleString('id-ID')}`;
}

function BalanceCard() {
  const { user } = useAuthStore();
  const { totalPropertyValueIdr, totalEarningsIdr } = usePortfolioStore();
  const [hidden, setHidden] = useState(user?.hideBalance ?? false);
  const accountValue = (user?.balanceIdr ?? 0) + totalPropertyValueIdr + totalEarningsIdr;

  const mask = (val: number) => (hidden ? 'IDR ••••••' : formatIDR(Math.round(val)));

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.balanceLabel}>My Balance</Text>
          <View style={styles.balanceAmountRow}>
            <Text style={styles.balanceAmount}>{mask(user?.balanceIdr ?? 0)}</Text>
            <TouchableOpacity onPress={() => setHidden((v) => !v)}>
              <Text style={styles.eyeIcon}>{hidden ? '○' : '●'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.propertyCountBadge}>
          <Text style={styles.propertyCountIcon}>⌂</Text>
          <Text style={styles.propertyCountText}>{usePortfolioStore.getState().holdings.length}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Property Value" value={mask(totalPropertyValueIdr)} />
        <StatCard label="Total Earnings" value={mask(totalEarningsIdr)} />
        <StatCard label="Account Value" value={mask(accountValue)} />
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statChart} />
    </View>
  );
}

function QuickActions() {
  const actions = [
    { icon: '📊', label: 'Asset\nOverview', onPress: () => router.push('/assets-overview') },
    { icon: '💰', label: 'Yield\nReports', onPress: () => router.push('/yield-reports') },
    { icon: '🎁', label: 'Referral\nCode', onPress: () => router.push('/referrals') },
    { icon: '🏦', label: 'Balance\nWithdrawal', onPress: () => router.push('/withdrawals') },
  ];

  return (
    <View style={styles.quickActions}>
      {actions.map((a) => (
        <TouchableOpacity key={a.label} style={styles.quickAction} onPress={a.onPress} activeOpacity={0.8}>
          <View style={styles.quickActionIcon}>
            <Text style={styles.quickActionEmoji}>{a.icon}</Text>
          </View>
          <Text style={styles.quickActionLabel}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const tokensLeft = property.tokensAvailable;
  const isRunningOut = property.status === 'running_out';

  return (
    <TouchableOpacity
      style={styles.propertyCard}
      onPress={() => router.push(`/property/${property.id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.propertyImagePlaceholder}>
        <Text style={styles.propertyImageText}>{property.name}</Text>
        <View style={styles.propertyLocation}>
          <Text style={styles.locationPin}>📍</Text>
          <Text style={styles.locationText}>{property.location}</Text>
        </View>
      </View>
      {isRunningOut && (
        <View style={styles.runningOutBadge}>
          <Text style={styles.runningOutText}>🔥 {tokensLeft.toLocaleString()} tokens left</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const { data: runningOut, refetch: refetchRunning } = useQuery({
    queryKey: ['properties', 'running-out-soon'],
    queryFn: () => propertiesApi.getRunningOutSoon().then((r) => r.data.data),
  });

  const { data: featured, refetch: refetchFeatured } = useQuery({
    queryKey: ['properties', 'featured'],
    queryFn: () => propertiesApi.getFeatured().then((r) => r.data.data),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRunning(), refetchFeatured()]);
    setRefreshing(false);
  }, [refetchRunning, refetchFeatured]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() ?? 'G'}</Text>
            </View>
            <Text style={styles.username}>{user?.username ?? 'GRIYAKU'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn}>
              <Text style={styles.headerBtnIcon}>↗</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}>
              <Text style={styles.headerBtnIcon}>🔔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <BalanceCard />

        {/* Quick Actions */}
        <QuickActions />

        {/* Promo Banner */}
        <View style={styles.promoBanner}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>LIGA CUAN</Text>
            <Text style={styles.promoSub}>Start investing, top the leaderboard, and claim your prize!</Text>
            <TouchableOpacity style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>View Leaderboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Running Out Soon */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Running Out Soon 🚀</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/marketplace')}>
              <Text style={styles.seeMore}>›</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={runningOut ?? []}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => <PropertyCard property={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.md }}
          />
        </View>

        {/* Featured Property */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Property</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/marketplace')}>
              <Text style={styles.seeMore}>See more ›</Text>
            </TouchableOpacity>
          </View>
          {(featured ?? []).map((p: Property) => (
            <TouchableOpacity
              key={p.id}
              style={styles.featuredCard}
              onPress={() => router.push(`/property/${p.id}`)}
              activeOpacity={0.9}
            >
              <View style={styles.featuredImagePlaceholder}>
                <View style={styles.featuredLocation}>
                  <Text style={styles.locationPin}>📍</Text>
                  <Text style={styles.featuredLocationText}>{p.location}</Text>
                </View>
                <Text style={styles.featuredName}>{p.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: '#fff',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.base },
  username: { fontWeight: '700', color: Colors.primary, fontSize: Fonts.sizes.base },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBtnIcon: { fontSize: 20 },

  balanceCard: {
    backgroundColor: '#fff',
    margin: Spacing.base,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.base },
  balanceLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginBottom: 4 },
  balanceAmountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  balanceAmount: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.primary },
  eyeIcon: { fontSize: 18, color: Colors.primary },
  propertyCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  propertyCountIcon: { fontSize: 16 },
  propertyCountText: { fontWeight: '700', color: Colors.primary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm },
  statLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginBottom: 4 },
  statValue: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  statChart: { height: 30, backgroundColor: Colors.primaryLight, borderRadius: Radius.sm },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    backgroundColor: '#fff',
    marginHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  quickAction: { alignItems: 'center', gap: Spacing.sm },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionEmoji: { fontSize: 22 },
  quickActionLabel: { fontSize: Fonts.sizes.xs, textAlign: 'center', color: Colors.textSecondary, lineHeight: 16 },

  promoBanner: {
    margin: Spacing.base,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
    overflow: 'hidden',
    padding: Spacing.base,
  },
  promoContent: { gap: Spacing.sm },
  promoTitle: { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.gold },
  promoSub: { fontSize: Fonts.sizes.sm, color: '#fff', opacity: 0.9 },
  promoBtn: {
    backgroundColor: Colors.gold,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  promoBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: Fonts.sizes.sm },

  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.base },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
  seeMore: { fontSize: Fonts.sizes.base, color: Colors.textSecondary },

  propertyCard: { width: 180, borderRadius: Radius.lg, overflow: 'hidden' },
  propertyImagePlaceholder: {
    width: 180,
    height: 130,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'flex-end',
    padding: Spacing.sm,
  },
  propertyImageText: { color: Colors.primaryDark, fontWeight: '700', fontSize: Fonts.sizes.sm },
  propertyLocation: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  locationPin: { fontSize: 10 },
  locationText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  runningOutBadge: {
    backgroundColor: Colors.errorLight,
    padding: Spacing.sm,
  },
  runningOutText: { fontSize: Fonts.sizes.xs, color: Colors.error, fontWeight: '600' },

  featuredCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  featuredImagePlaceholder: {
    height: 200,
    backgroundColor: Colors.primaryLight,
    padding: Spacing.base,
    justifyContent: 'flex-end',
  },
  featuredLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featuredLocationText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  featuredName: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
});
