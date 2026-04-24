import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { transactionsApi } from '../../services/api';
import { Transaction } from '../../types';
import { Badge } from '../../components/ui/Badge';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Rental', value: 'rental_distribution' },
  { label: 'Buy', value: 'buy' },
  { label: 'Sell', value: 'sell' },
  { label: 'Swap', value: 'swap' },
];

function formatIDR(val: number) {
  return `IDR ${Math.round(val).toLocaleString('id-ID')}`;
}

function TransactionCard({ tx }: { tx: Transaction }) {
  const typeLabel = tx.type === 'rental_distribution' ? 'Rental distribution' :
    tx.type === 'buy' ? 'Token purchase' :
    tx.type === 'sell' ? 'Token sale' : 'Token swap';

  const formattedDate = new Date(tx.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short',
  }) + ', ' + new Date(tx.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>{typeLabel}</Text>
        <Text style={styles.cardDate}>{formattedDate}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.propertyImage} />
        <Text style={styles.amount}>{formatIDR(tx.totalAmountIdr)}</Text>
        <Badge label={tx.status === 'completed' ? 'Received' : tx.status} variant={tx.status === 'completed' ? 'success' : 'neutral'} />
      </View>
      <Text style={styles.txId}>{tx.id}</Text>
    </View>
  );
}

export default function TransactionsScreen() {
  const [filter, setFilter] = useState('all');

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions', filter],
    queryFn: () => transactionsApi.list({ type: filter === 'all' ? undefined : filter }).then((r) => r.data.data),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Transactions</Text>

      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterPicker]}>
          <Text style={styles.filterText}>
            {FILTERS.find((f) => f.value === filter)?.label ?? 'All'} ∨
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }) => <TransactionCard tx={item} />}
        contentContainerStyle={{ gap: Spacing.sm, padding: Spacing.base, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💵</Text>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, padding: Spacing.base },
  filterRow: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  filterPicker: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  filterText: { fontSize: Fonts.sizes.base, color: Colors.textPrimary },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.base, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardType: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  cardDate: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  propertyImage: { width: 64, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight },
  amount: { flex: 1, fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.textPrimary },
  txId: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Fonts.sizes.base, color: Colors.textMuted },
});
