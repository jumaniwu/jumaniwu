import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Share, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Colors, Fonts, Spacing, Radius } from '../constants/colors';
import { referralsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function ReferralsScreen() {
  const { user } = useAuthStore();
  const referralLink = `https://griyaku.app/invite/${user?.referralCode ?? ''}`;

  const { data: stats } = useQuery({
    queryKey: ['referrals', 'stats'],
    queryFn: () => referralsApi.getMyStats().then((r) => r.data.data),
  });

  const copyLink = async () => {
    await Clipboard.setStringAsync(referralLink);
    Alert.alert('Copied!', 'Referral link copied to clipboard');
  };

  const shareLink = async () => {
    await Share.share({ message: `Join GRIYAKU and invest in property from IDR 10,000! Use my referral link: ${referralLink}` });
  };

  const socialButtons = [
    { icon: '💬', label: 'Whatsapp', color: '#25D366' },
    { icon: 'f', label: 'Facebook', color: '#1877F2' },
    { icon: '✕', label: 'X', color: '#000' },
    { icon: '↗', label: 'Share', color: Colors.textSecondary },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Referrals</Text>
        <TouchableOpacity style={styles.topReferrersBtn} onPress={() => router.push('/top-referrers')}>
          <Text style={styles.topReferrersIcon}>🏆</Text>
          <Text style={styles.topReferrersText}>Top Referrers</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Gift illustration */}
        <View style={styles.illustrationSection}>
          <Text style={styles.giftEmoji}>🎁🎁</Text>
          <Text style={styles.heading}>Refer and Earn!</Text>
          <Text style={styles.subtext}>
            Refer a friend and earn a{' '}
            <Text style={styles.highlight}>1% CASHBACK</Text>
            {' '}after they have made their first purchase on GRIYAKU
          </Text>
        </View>

        {/* Referral Link */}
        <View style={styles.linkRow}>
          <Text style={styles.linkText} numberOfLines={1}>{referralLink}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={copyLink}>
            <Text style={styles.copyBtnText}>Copy link</Text>
          </TouchableOpacity>
        </View>

        {/* Social Buttons */}
        <View style={styles.socialRow}>
          {socialButtons.map((s) => (
            <TouchableOpacity key={s.label} style={styles.socialBtn} onPress={shareLink}>
              <View style={[styles.socialIcon, { backgroundColor: s.color + '20' }]}>
                <Text style={[styles.socialIconText, { color: s.color }]}>{s.icon}</Text>
              </View>
              <Text style={styles.socialLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* How It Works */}
        <Text style={styles.howTitle}>How It Works</Text>

        {[
          { icon: '📨', title: 'Invite Your Friend', desc: 'Send your unique link to your friends inviting them to use GRIYAKU' },
          { icon: '📝', title: 'Friend Registers', desc: 'Your friend registers using your referral link and creates an account' },
          { icon: '💰', title: 'Both Earn Rewards', desc: 'Once they make their first purchase, you both receive cashback rewards' },
        ].map((step, i) => (
          <View key={i} style={styles.stepCard}>
            <Text style={styles.stepIcon}>{step.icon}</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {/* Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalReferred}</Text>
              <Text style={styles.statLabel}>Friends Referred</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>IDR {stats.totalCashbackIdr?.toLocaleString('id-ID') ?? 0}</Text>
              <Text style={styles.statLabel}>Total Cashback</Text>
            </View>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base, borderBottomWidth: 1, borderColor: Colors.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  title: { flex: 1, fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  topReferrersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  topReferrersIcon: { fontSize: 14 },
  topReferrersText: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.primary },

  scroll: { padding: Spacing.xl },
  illustrationSection: { alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  giftEmoji: { fontSize: 64 },
  heading: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtext: { fontSize: Fonts.sizes.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  highlight: { fontWeight: '800', color: Colors.textPrimary },

  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.base, gap: Spacing.sm },
  linkText: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.primary },
  copyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.sm },

  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, marginBottom: Spacing.xl },
  socialBtn: { alignItems: 'center', gap: Spacing.sm },
  socialIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  socialIconText: { fontSize: 22, fontWeight: '700' },
  socialLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },

  divider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.xl },
  howTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xl },

  stepCard: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.xl },
  stepIcon: { fontSize: 40 },
  stepContent: { flex: 1, gap: 4 },
  stepTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
  stepDesc: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, lineHeight: 20 },

  statsCard: { flexDirection: 'row', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.primary + '40' },
});
