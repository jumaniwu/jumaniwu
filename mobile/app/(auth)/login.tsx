import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { setTokens, setUser } = useAuthStore();

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Minimum 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password });
      await setTokens(data.data.accessToken, data.data.refreshToken);
      setUser(data.data.user);
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Please check your credentials');
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
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>Welcome back to GRIYAKU</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            isPassword
          />

          <TouchableOpacity style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button title="Login" onPress={handleLogin} loading={loading} size="lg" fullWidth />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>Register Now</Text>
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
  forgotRow: { alignSelf: 'flex-end' },
  forgotText: { color: Colors.primary, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 'auto', paddingTop: Spacing.xxl },
  footerText: { color: Colors.textSecondary, fontSize: Fonts.sizes.base },
  registerLink: { color: Colors.textPrimary, fontWeight: '700', fontSize: Fonts.sizes.base },
});
