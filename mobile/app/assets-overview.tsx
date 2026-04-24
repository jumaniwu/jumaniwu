import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../constants/colors';
import { investmentsApi } from '../services/api';
import { TokenHolding } from '../types';
import { Button } from '../components/ui/Button';

function formatIDR(val: number) {
  return `IDR ${Math.round(val).toLocaleString('id-ID')}`;
}

function HoldingCard({ holding }: { holding: TokenHolding }) {
  const ownershipPct = ((holding.tokenAmount / holding.property.totalTokens) * 100).toFixed(4);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.propertyImage} />
        <View style={styles.locationBadge}>
          <Text style={styles.locationPin}>📍</Text>
          <Text style={styles.locationText}>{holding.property.location}</Text>
        </View>
        <Text style={styles.propertyName}>{holding.property.name}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Tokens</Text>
            <Text style={styles.statValue}>{holding.tokenAmount} ({ownershipPct}%)</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Locked Tokens ⓘ</Text>
            <View style={styles.lockedRow}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.statValue}>{holding.lockedTokens}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Tokens Available</Text>
          <Text style={styles.statValue}>{holding.tokenAmount - holding.lockedTokens}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Current Value</Text>
            <Text style={[styles.statValue, styles.statValueBold]}>{formatIDR(holding.currentValueIdr)}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Last Rent Earned (annualized %)</Text>
            <Text style={[styles.statValue, styles.statValueBold, styles.statValueGreen]}>
              {formatIDR(holding.lastRentEarnedIdr)} ({holding.lastRentAnnualizedPct.toFixed(2)}%)
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Rent Earned (annualized %)</Text>
            <Text style={[styles.statValue, styles.statValueBold, styles.statValueGreen]}>
              {formatIDR(holding.totalRentEarnedIdr)} ({holding.totalRentAnnualizedPct.toFixed(2)}%)
            </Text>
          </View>
          <View style={styles.actionBtns}>
            <Button title="⇄ Swap" onPress={() => {}} variant="outline" size="sm" />
            <Button title="Sell" onPress={() => {}} variant="outline" size="sm" icon={<Text>💸</Text>} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function AssetsOverviewScreen() {
  const [search, setSearch] = useState('');
  const [showZero, setShowZero] = useState(true);

  const { data: holdings = [] } = useQuery<TokenHolding[]>({
    queryKey: ['portfolio'],
    queryFn: () => investmentsApi.getPortfolio().then((r) => r.data.data),
  });

  const filtered = holdings.filter((h) =>
    h.property.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Assets Overview</Text>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Property List</Text>
        <TouchableOpacity style={styles.hideBtn} onPress={() => setShowZero((v) => !v)}>
          <Text style={styles.hideIcon}>👁</Text>
          <Text style={styles.hideText}>{showZero ? 'Hide' : 'Show'} 0 Assets</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by property name"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => <HoldingCard holding={item} />}
        contentContainerStyle={{ gap: Spacing.base, padding: Spacing.base, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No assets yet</Text>
            <Button title="Go to Marketplace" onPress={() => { router.back(); router.push('/(tabs)/marketplace'); }} style={{ marginTop: Spacing.base }} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base, backgroundColor: '#fff' },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingTop: Spacing.base },
  listTitle: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.primary },
  hideBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hideIcon: { fontSize: 16 },
  hideText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, margin: Spacing.base, backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 44 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: Fonts.sizes.base, color: Colors.textPrimary },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader: { height: 120, backgroundColor: Colors.primaryLight, padding: Spacing.base, justifyContent: 'flex-end' },
  propertyImage: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.primaryLight },
  locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', alignSelf: 'flex-end', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, gap: 4, marginBottom: 4 },
  locationPin: { fontSize: 10 },
  locationText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  propertyName: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.base, backgroundColor: Colors.primary + 'CC', alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  cardBody: { padding: Spacing.base, gap: Spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  statItem: { gap: 2, flex: 1 },
  statLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  statValue: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary },
  statValueBold: { fontWeight: '700' },
  statValueGreen: { color: Colors.primary },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockIcon: { fontSize: 12 },
  divider: { height: 1, backgroundColor: Colors.border },
  actionBtns: { flexDirection: 'row', gap: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Fonts.sizes.base, color: Colors.textMuted },
});
