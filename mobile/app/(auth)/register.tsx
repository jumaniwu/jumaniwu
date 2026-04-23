import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Colors, Fonts, Spacing } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function RegisterScreen() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', referralCode: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { setTokens, setUser } = useAuthStore();

  const set = (key: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = 'Username is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await authApi.register({
        username: form.username,
        email: form.email,
        password: form.password,
        referralCode: form.referralCode || undefined,
      });
      await setTokens(data.data.accessToken, data.data.refreshToken);
      setUser(data.data.user);
      router.replace('/(auth)/terms');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join GRIYAKU and start investing</Text>
        </View>

        <View style={styles.form}>
          <Input label="Username" placeholder="Choose a username" value={form.username} onChangeText={set('username')} error={errors.username} autoCapitalize="none" />
          <Input label="Email" placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} error={errors.email} />
          <Input label="Password" placeholder="Min 8 characters" value={form.password} onChangeText={set('password')} error={errors.password} isPassword />
          <Input label="Confirm Password" placeholder="Re-enter your password" value={form.confirmPassword} onChangeText={set('confirmPassword')} error={errors.confirmPassword} isPassword />
          <Input label="Referral Code (Optional)" placeholder="Enter referral code" value={form.referralCode} onChangeText={set('referralCode')} autoCapitalize="characters" />

          <Button title="Create Account" onPress={handleRegister} loading={loading} size="lg" fullWidth style={{ marginTop: Spacing.sm }} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: Spacing.xl },
  backArrow: { fontSize: 28, color: Colors.textPrimary },
  header: { marginBottom: Spacing.xxl },
  title: { fontSize: Fonts.sizes.xxxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.xs },
  subtitle: { fontSize: Fonts.sizes.base, color: Colors.textSecondary },
  form: { gap: Spacing.base },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { color: Colors.textSecondary, fontSize: Fonts.sizes.base },
  loginLink: { color: Colors.textPrimary, fontWeight: '700', fontSize: Fonts.sizes.base },
});
