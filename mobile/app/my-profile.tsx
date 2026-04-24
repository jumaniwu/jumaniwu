import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Modal, Linking,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Colors, Fonts, Spacing, Radius } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

function InfoRow({ label, value, verified, onCopy }: { label: string; value: string; verified?: boolean; onCopy?: () => void }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text style={styles.infoValue}>{value}</Text>
        {verified && <Text style={styles.verifiedIcon}>✅</Text>}
        {onCopy && (
          <TouchableOpacity onPress={onCopy}>
            <Text style={styles.copyIcon}>⎘</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function WalletWarningModal({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.warningTitle}>Warning!</Text>
          <View style={styles.warningList}>
            <Text style={styles.warningItem}>• Do not send any crypto assets to this wallet address. We are not responsible for any loss of assets sent to this wallet address.</Text>
            <Text style={styles.warningItem}>• Do not share your wallet address, because all your assets and transactions will be visible to others.</Text>
          </View>
          <TouchableOpacity style={styles.continueBtn} onPress={onContinue}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function MyProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const [showWalletWarning, setShowWalletWarning] = useState(false);
  const [walletVisible, setWalletVisible] = useState(false);

  const copyId = async () => {
    if (user?.id) {
      await Clipboard.setStringAsync(user.id);
      Alert.alert('Copied', 'User ID copied to clipboard');
    }
  };

  const handleViewWallet = () => setShowWalletWarning(true);

  const onWalletContinue = () => {
    setShowWalletWarning(false);
    setWalletVisible(true);
  };

  const shortWallet = user?.walletAddress
    ? `${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-8)}`
    : 'Not connected';

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await clearAuth(); router.replace('/(auth)/'); } },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() ?? 'G'}</Text>
          </View>
          <TouchableOpacity style={styles.editPhotoBtn}>
            <Text style={styles.editPhotoText}>Edit Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRowWithEdit}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user?.username}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <InfoRow label="GRIYAKU ID" value={user?.id?.slice(-10) ?? '—'} onCopy={copyId} />
          <InfoRow label="Name" value={user?.name ?? '—'} />
          <InfoRow label="Email" value={user?.email ?? '—'} verified={user?.isVerified} />
          <InfoRow label="Phone" value={user?.phoneNumber ?? '—'} verified={!!user?.phoneNumber} />
          <InfoRow label="Date of birth" value={user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '—'} />
        </View>

        {/* Support */}
        <View style={styles.supportCard}>
          <Text style={styles.supportIcon}>🎧</Text>
          <Text style={styles.supportText}>
            If there are problems with your account. Please contact GRIYAKU via Whatsapp or email{' '}
            <Text style={styles.supportLink}>hello@griyaku.app</Text>
          </Text>
        </View>

        {/* Blockchain */}
        <View style={styles.blockchainCard}>
          <TouchableOpacity style={styles.blockchainHeader} onPress={handleViewWallet}>
            <Text style={styles.sectionTitle}>Blockchain</Text>
            <Text style={styles.chevron}>∨</Text>
          </TouchableOpacity>
          {walletVisible && (
            <TouchableOpacity
              style={styles.walletRow}
              onPress={() => user?.walletAddress && Linking.openURL(`https://polygonscan.com/address/${user.walletAddress}`)}
            >
              <Text style={styles.walletIcon}>👛</Text>
              <View>
                <Text style={styles.walletLabel}>Wallet Address</Text>
                <Text style={styles.walletAddress}>{shortWallet}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => { await clearAuth(); router.replace('/(auth)/'); }}
        >
          <Text style={styles.logoutIcon}>⎋</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <WalletWarningModal visible={showWalletWarning} onContinue={onWalletContinue} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  scroll: { padding: Spacing.base, gap: Spacing.base },

  avatarSection: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: Fonts.sizes.xxxl, fontWeight: '700', color: '#fff' },
  editPhotoBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.base, paddingVertical: 6 },
  editPhotoText: { color: Colors.primary, fontWeight: '600', fontSize: Fonts.sizes.sm },

  sectionTitle: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  infoCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  infoRowWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  infoCol: { gap: 2 },
  infoLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoValue: { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.textPrimary },
  verifiedIcon: { fontSize: 14 },
  copyIcon: { fontSize: 18, color: Colors.textSecondary },
  editBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  editBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: '600' },

  supportCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'flex-start' },
  supportIcon: { fontSize: 28 },
  supportText: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  supportLink: { color: Colors.primary, fontWeight: '600' },

  blockchainCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  blockchainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base },
  chevron: { fontSize: 18, color: Colors.primary },
  walletRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', padding: Spacing.base, borderTopWidth: 1, borderColor: Colors.border },
  walletIcon: { fontSize: 28 },
  walletLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  walletAddress: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.primary },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.errorLight },
  logoutIcon: { fontSize: 20 },
  logoutText: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.error },
  deleteBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  deleteText: { fontSize: Fonts.sizes.base, color: Colors.textSecondary, textDecorationLine: 'underline' },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.lg },
  warningTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.error, textAlign: 'center' },
  warningList: { gap: Spacing.md },
  warningItem: { fontSize: Fonts.sizes.base, color: Colors.textSecondary, lineHeight: 22 },
  continueBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.base },
});
