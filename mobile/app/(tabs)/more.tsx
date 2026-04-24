import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { usersApi } from '../../services/api';

function MenuItem({ icon, label, onPress, rightEl }: { icon: string; label: string; onPress?: () => void; rightEl?: React.ReactNode }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>{rightEl ?? <Text style={styles.menuArrow}>›</Text>}</View>
    </TouchableOpacity>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function MoreScreen() {
  const { user, updateUser, clearAuth } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/');
        },
      },
    ]);
  };

  const toggleLanguage = async () => {
    const newLang = user?.language === 'id' ? 'en' : 'id';
    await usersApi.updateLanguage(newLang);
    updateUser({ language: newLang });
  };

  const toggleHideBalance = async () => {
    const newHide = !user?.hideBalance;
    await usersApi.updateHideBalance(newHide);
    updateUser({ hideBalance: newHide });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Text style={styles.title}>My Account</Text>

        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/my-profile')} activeOpacity={0.8}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() ?? 'G'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? user?.username ?? 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileId}>GRIYAKU ID: {user?.id?.slice(-8)}</Text>
          </View>
          <Text style={styles.profileArrow}>›</Text>
        </TouchableOpacity>

        {/* Referral Banner */}
        <TouchableOpacity style={styles.referralBanner} onPress={() => router.push('/referrals')}>
          <View>
            <Text style={styles.referralText}>Invite friends and earn{'\n'}reward for every referral.</Text>
          </View>
          <Text style={styles.referralIcon}>📣</Text>
        </TouchableOpacity>

        {/* Preferences */}
        <MenuSection title="Preferences">
          <MenuItem icon="⏱" label="Pending Actions" onPress={() => {}} />
          <MenuItem
            icon="🌐"
            label="Language"
            rightEl={
              <View style={styles.langToggle}>
                <Text style={[styles.langText, user?.language === 'id' && styles.langActive]}>ID</Text>
                <Text style={styles.langSep}> | </Text>
                <Text style={[styles.langText, user?.language !== 'id' && styles.langActive]}>EN</Text>
              </View>
            }
            onPress={toggleLanguage}
          />
          <MenuItem
            icon="💰"
            label="Hide Balance"
            rightEl={
              <Switch
                value={user?.hideBalance ?? false}
                onValueChange={toggleHideBalance}
                trackColor={{ true: Colors.primary }}
              />
            }
          />
          <MenuItem icon="💱" label="Currency" onPress={() => {}} />
          <MenuItem icon="🛡" label="Security" onPress={() => {}} />
        </MenuSection>

        {/* Benefits */}
        <MenuSection title="Benefits">
          <MenuItem icon="🎁" label="Rewards" onPress={() => {}} />
          <MenuItem icon="🏷" label="Redeem Gift" onPress={() => {}} />
        </MenuSection>

        {/* General */}
        <MenuSection title="General">
          <MenuItem icon="🧮" label="Calculator" onPress={() => {}} />
          <MenuItem icon="🎓" label="GoLearn" onPress={() => {}} />
          <MenuItem icon="📊" label="Yearly Summary" onPress={() => {}} />
          <MenuItem icon="⭐" label="Rate GRIYAKU App" rightEl={<Text style={styles.versionText}>Version: 1.0.0</Text>} />
        </MenuSection>

        {/* About */}
        <MenuSection title="About GRIYAKU">
          <MenuItem icon="❓" label="FAQs" onPress={() => {}} />
          <MenuItem icon="👥" label="About Us" onPress={() => {}} />
          <MenuItem icon="📋" label="Terms of Service" onPress={() => router.push('/(auth)/terms')} />
          <MenuItem icon="🔒" label="Privacy Policy" onPress={() => {}} />
        </MenuSection>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>⎋</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.primary, padding: Spacing.base },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#fff', marginHorizontal: Spacing.base, borderRadius: Radius.lg, padding: Spacing.base, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, marginBottom: Spacing.base },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.lg },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  profileId: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  profileArrow: { fontSize: 24, color: Colors.textMuted },

  referralBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryLight, marginHorizontal: Spacing.base, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.primary + '40' },
  referralText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.primary, lineHeight: 20 },
  referralIcon: { fontSize: 40 },

  section: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionTitle: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  sectionCard: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden' },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  menuIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: Fonts.sizes.base, color: Colors.textPrimary },
  menuRight: { alignItems: 'flex-end' },
  menuArrow: { fontSize: 20, color: Colors.textMuted },

  langToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
  langText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textMuted },
  langActive: { color: Colors.primary },
  langSep: { color: Colors.border },

  versionText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: '#fff', marginHorizontal: Spacing.base, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.errorLight },
  logoutIcon: { fontSize: 20, color: Colors.error },
  logoutText: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.error },
});
