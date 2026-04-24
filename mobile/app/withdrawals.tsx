import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../constants/colors';
import { bankAccountsApi, withdrawalsApi } from '../services/api';
import { Withdrawal } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';

function AddBankModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => bankAccountsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      onClose();
      Alert.alert('Success', 'Bank account added successfully');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.message || 'Failed to add bank account'),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Add Bank Account</Text>
          <Input label="Bank Name" placeholder="e.g. BCA, Mandiri, BRI" value={form.bankName} onChangeText={(v) => setForm((f) => ({ ...f, bankName: v }))} />
          <Input label="Account Number" placeholder="Enter account number" keyboardType="numeric" value={form.accountNumber} onChangeText={(v) => setForm((f) => ({ ...f, accountNumber: v }))} />
          <Input label="Account Holder Name" placeholder="Name on the account" value={form.accountHolder} onChangeText={(v) => setForm((f) => ({ ...f, accountHolder: v }))} />
          <Button title="Save Bank Account" onPress={() => mutation.mutate()} loading={mutation.isPending} size="lg" fullWidth />
          <Button title="Cancel" onPress={onClose} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    </Modal>
  );
}

function formatIDR(val: number) {
  return `IDR ${Math.round(val).toLocaleString('id-ID')}`;
}

export default function WithdrawalsScreen() {
  const [addBankVisible, setAddBankVisible] = useState(false);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.list().then((r) => r.data.data),
  });

  const { data: withdrawals = [] } = useQuery<Withdrawal[]>({
    queryKey: ['withdrawals'],
    queryFn: () => withdrawalsApi.list().then((r) => r.data.data),
  });

  const hasBankAccount = bankAccounts.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawals</Text>
        <TouchableOpacity>
          <Text style={styles.historyLink}>Bank History</Text>
        </TouchableOpacity>
      </View>

      {/* Bank Account Card */}
      <View style={styles.bankCard}>
        {hasBankAccount ? (
          bankAccounts.map((account: any) => (
            <View key={account.id} style={styles.bankInfo}>
              <Text style={styles.bankName}>{account.bankName}</Text>
              <Text style={styles.bankAccount}>{account.accountNumber}</Text>
              <Text style={styles.bankHolder}>{account.accountHolder}</Text>
            </View>
          ))
        ) : (
          <>
            <Text style={styles.notConfigured}>Not configured yet</Text>
            <Button
              title="+ Add Bank Account"
              onPress={() => setAddBankVisible(true)}
              variant="outline"
              size="md"
              style={styles.addBankBtn}
            />
          </>
        )}
      </View>

      {/* Withdrawal History */}
      <FlatList
        data={withdrawals}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => (
          <View style={styles.withdrawalCard}>
            <View style={styles.withdrawalInfo}>
              <Text style={styles.withdrawalAmount}>{formatIDR(item.amountIdr)}</Text>
              <Text style={styles.withdrawalDate}>{new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </View>
            <Badge
              label={item.status}
              variant={item.status === 'completed' ? 'success' : item.status === 'failed' ? 'error' : 'warning'}
            />
          </View>
        )}
        contentContainerStyle={{ gap: Spacing.sm, padding: Spacing.base, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💵</Text>
            <Text style={styles.emptyText}>There are no withdrawal histories</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <Button
          title="Create Withdrawal"
          onPress={() => {
            if (!hasBankAccount) {
              Alert.alert('Bank Account Required', 'Please add a bank account first');
              return;
            }
            Alert.alert('Create Withdrawal', 'Feature coming soon');
          }}
          size="lg"
          fullWidth
        />
      </View>

      <AddBankModal visible={addBankVisible} onClose={() => setAddBankVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  title: { flex: 1, fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  historyLink: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary },
  bankCard: { margin: Spacing.base, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  notConfigured: { color: '#fff', fontSize: Fonts.sizes.base, opacity: 0.8 },
  addBankBtn: { borderColor: '#fff' },
  bankInfo: { alignItems: 'center', gap: 4 },
  bankName: { color: '#fff', fontSize: Fonts.sizes.lg, fontWeight: '700' },
  bankAccount: { color: '#fff', fontSize: Fonts.sizes.base, opacity: 0.9 },
  bankHolder: { color: '#fff', fontSize: Fonts.sizes.sm, opacity: 0.7 },
  withdrawalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.md },
  withdrawalInfo: { gap: 4 },
  withdrawalAmount: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  withdrawalDate: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Fonts.sizes.base, color: Colors.textSecondary, textAlign: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.base, backgroundColor: '#fff', borderTopWidth: 1, borderColor: Colors.border },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.base },
  modalTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
});
