import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { Button } from '../../components/ui/Button';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.logoSection}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoIcon}>
              {/* Network/blockchain node icon */}
              <Text style={styles.logoText}>⬡</Text>
            </View>
          </View>
          <Text style={styles.welcome}>Welcome!</Text>
          <Text style={styles.subtitle}>Login to your Account</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="  Login"
            onPress={() => router.push('/(auth)/login')}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Text style={styles.loginIcon}>⟶</Text>}
          />

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <SocialButton
            icon="G"
            iconColor="#EA4335"
            label="Login with Google"
            onPress={() => {}}
          />
          <SocialButton
            icon="f"
            iconColor="#1877F2"
            label="Login with Facebook"
            onPress={() => {}}
          />
          <SocialButton
            icon=""
            iconColor="#000"
            label="Login with Apple"
            onPress={() => {}}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>Register Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SocialButton({ icon, iconColor, label, onPress }: { icon: string; iconColor: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.socialBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.socialIcon, { color: iconColor }]}>{icon}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  logoSection: { alignItems: 'center', marginTop: Spacing.xxxl, marginBottom: Spacing.xxxl },
  logoWrapper: { marginBottom: Spacing.xl },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 40, color: Colors.primary },
  welcome: { fontSize: Fonts.sizes.xxxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle: { fontSize: Fonts.sizes.base, color: Colors.textSecondary },
  actions: { gap: Spacing.md },
  loginIcon: { color: '#fff', fontSize: Fonts.sizes.lg },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.xs },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, fontWeight: '500' },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
  },
  socialIcon: { fontSize: Fonts.sizes.lg, fontWeight: '700', width: 24, textAlign: 'center' },
  socialLabel: { fontSize: Fonts.sizes.base, fontWeight: '600', color: Colors.textPrimary },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 'auto', paddingBottom: Spacing.xl },
  footerText: { color: Colors.textSecondary, fontSize: Fonts.sizes.base },
  registerLink: { color: Colors.textPrimary, fontWeight: '700', fontSize: Fonts.sizes.base },
});
