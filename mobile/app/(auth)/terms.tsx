import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors, Fonts, Spacing } from '../../constants/colors';
import { Button } from '../../components/ui/Button';

export default function TermsScreen() {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = ({ nativeEvent }: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const isBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
    if (isBottom) setScrolledToBottom(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Terms of Service</Text>
        <ScrollView style={styles.scroll} onScroll={handleScroll} scrollEventThrottle={16}>
          <Text style={styles.heading}>TERMS OF SERVICE{'\n'}THE GRIYAKU PLATFORM AND SERVICES{'\n'}Effective as of 1 January 2026</Text>
          <Text style={styles.body}>
            These Terms of Service constitute an arrangement governing the use of the GRIYAKU Website and/or the GRIYAKU Application and/or the Services and/or GRIYAKU social media channels, including but not limited to Instagram, Facebook, YouTube, TikTok, X, or other instant messaging services (collectively, the "GRIYAKU Platform") by a User (as defined below) of GRIYAKU.{'\n\n'}
            These Terms of Service apply to the services and/or the Website and/or the Application (as defined below) provided and managed by GRIYAKU.{'\n\n'}
            In order to provide the Services (as defined below) to the User, the User must first register an Account on the GRIYAKU Platform. GRIYAKU shall verify the information provided by the User during registration. GRIYAKU retains the absolute and sole discretion to approve or reject the registration of a User's Account in relation to the verification results obtained by GRIYAKU.{'\n\n'}
            Users are required to read these Terms of Service carefully before registering an Account on the GRIYAKU Platform. By registering an Account on the GRIYAKU Platform, You, as a User, hereby declare that You have read, understood, and agree to comply with and be legally bound by these Terms of Service and all policies and documents referenced herein.{'\n\n'}
            GRIYAKU offers fractional property investment services through blockchain technology. Each property is tokenized and represented as digital tokens on the Polygon blockchain network. Investors may purchase, sell, or swap these tokens subject to the terms herein.{'\n\n'}
            Minimum investment starts from IDR 10,000 per token. Returns are derived from rental income distributed monthly and potential capital appreciation over time. Past performance does not guarantee future returns. Investment in property carries risks including but not limited to market fluctuations, vacancy periods, and regulatory changes.{'\n\n'}
            By using this platform you acknowledge that you are investing with funds you can afford to risk, and that GRIYAKU does not guarantee any specific return on investment.{'\n\n'}
            GRIYAKU is regulated and operates under applicable Indonesian financial regulations. This service is subject to the oversight of OJK (Otoritas Jasa Keuangan).{'\n\n'}
            All blockchain transactions are irreversible. Users are solely responsible for ensuring the accuracy of their wallet addresses and transaction details.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title="Agree"
            onPress={() => router.replace('/(tabs)/')}
            size="lg"
            fullWidth
            disabled={!scrolledToBottom}
          />
          {!scrolledToBottom && (
            <Text style={styles.scrollHint}>Please scroll to bottom to agree</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.lg },
  heading: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.base, lineHeight: 20 },
  scroll: { flex: 1 },
  body: { fontSize: Fonts.sizes.base, color: Colors.textSecondary, lineHeight: 24 },
  footer: { paddingVertical: Spacing.xl, gap: Spacing.sm },
  scrollHint: { textAlign: 'center', fontSize: Fonts.sizes.xs, color: Colors.textMuted },
});
