import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../constants/colors';
import { yieldsApi } from '../services/api';
import { YieldReceipt } from '../types';
import { Badge } from '../components/ui/Badge';

function formatIDR(val: number) {
  return `IDR ${Math.round(val).toLocaleString('id-ID')}`;
}

function YieldCard({ receipt }: { receipt: YieldReceipt }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.propertyName}>{receipt.propertyName}</Text>
        <Badge label="Received" variant="success" icon={<Text style={{ fontSize: 10 }}>✓</Text>} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Transaction ID</Text>
        <Text style={styles.txId}>{receipt.transactionId}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Value</Text>
        <Text style={styles.value}>{formatIDR(receipt.amountIdr)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Rental Month</Text>
        <Text style={styles.value}>
          {String(receipt.month).padStart(2, '0')}/{receipt.year}
        </Text>
      </View>
    </View>
  );
}

export default function YieldReportsScreen() {
  const [selectedProperty, setSelectedProperty] = useState<string | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [selectedYear, setSelectedYear] = useState<number | undefined>();

  const { data: receipts = [] } = useQuery<YieldReceipt[]>({
    queryKey: ['yields', selectedProperty, selectedMonth, selectedYear],
    queryFn: () => yieldsApi.list({ propertyId: selectedProperty, month: selectedMonth, year: selectedYear }).then((r) => r.data.data),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Yield Reports</Text>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity style={styles.filterPicker}>
          <Text style={styles.filterText}>All ∨</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPicker}>
          <Text style={styles.filterText}>Month And Year ∨</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={receipts}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <YieldCard receipt={item} />}
        contentContainerStyle={{ gap: Spacing.md, padding: Spacing.base, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No yield reports yet</Text>
            <Text style={styles.emptySubtext}>Invest in a property to start earning rental income</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  filters: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.base },
  filterPicker: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  filterText: { fontSize: Fonts.sizes.base, color: Colors.textPrimary },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  propertyName: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: Fonts.sizes.base, color: Colors.textSecondary },
  txId: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  value: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
  emptySubtext: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, textAlign: 'center' },
});
