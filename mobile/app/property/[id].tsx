import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { propertiesApi, investmentsApi } from '../../services/api';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TopHolder, YieldChartData, PropertyTimeline } from '../../types';

function formatIDR(val: number) {
  return `IDR ${Math.round(val).toLocaleString('id-ID')}`;
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionArrow}>{open ? '∨' : '›'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function InvestModal({ property, visible, onClose }: { property: any; visible: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleInvest = async () => {
    setLoading(true);
    try {
      await investmentsApi.buy({ propertyId: property.id, tokenAmount: amount });
      Alert.alert('Success!', `You have purchased ${amount} tokens of ${property.name}`);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Investment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Invest in {property?.name}</Text>
          <Text style={styles.modalPrice}>Price per token: {formatIDR(property?.tokenPriceIdr ?? 0)}</Text>
          <View style={styles.amountRow}>
            <TouchableOpacity style={styles.amountBtn} onPress={() => setAmount((a) => Math.max(1, a - 1))}>
              <Text style={styles.amountBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.amountValue}>{amount}</Text>
            <TouchableOpacity style={styles.amountBtn} onPress={() => setAmount((a) => a + 1)}>
              <Text style={styles.amountBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.totalCost}>Total: {formatIDR((property?.tokenPriceIdr ?? 0) * amount)}</Text>
          <Button title="Confirm Investment" onPress={handleInvest} loading={loading} size="lg" fullWidth />
          <Button title="Cancel" onPress={onClose} variant="ghost" size="md" fullWidth />
        </View>
      </View>
    </Modal>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [investVisible, setInvestVisible] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const { data: property } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.getById(id).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: topHolders = [] } = useQuery<TopHolder[]>({
    queryKey: ['property', id, 'top-holders'],
    queryFn: () => propertiesApi.getTopHolders(id).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: yieldHistory = [] } = useQuery<YieldChartData[]>({
    queryKey: ['property', id, 'yield-history'],
    queryFn: () => propertiesApi.getYieldHistory(id).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery<PropertyTimeline[]>({
    queryKey: ['property', id, 'timeline'],
    queryFn: () => propertiesApi.getTimeline(id).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: blockchain } = useQuery({
    queryKey: ['property', id, 'blockchain'],
    queryFn: () => propertiesApi.getBlockchain(id).then((r) => r.data.data),
    enabled: !!id,
  });

  if (!property) return null;

  const tokensSold = property.totalTokens - property.tokensAvailable;
  const ownershipPct = ((tokensSold / property.totalTokens) * 100).toFixed(0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView stickyHeaderIndices={[0]}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{property.name}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Photo Gallery */}
        <View style={styles.gallery}>
          <View style={styles.mainPhoto}>
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoText}>{property.name}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
            {(property.images?.length > 0 ? property.images : ['1', '2', '3', '4']).slice(0, 4).map((img: string, i: number) => (
              <TouchableOpacity key={i} onPress={() => setActiveImage(i)} style={[styles.thumbnail, activeImage === i && styles.thumbnailActive]}>
                <View style={styles.thumbnailPlaceholder} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.thumbnail}>
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.morePhotos}>+6</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Status + Airbnb */}
        <View style={styles.statusRow}>
          <Badge label="Available" variant="success" />
          {property.airbnbUrl && (
            <TouchableOpacity style={styles.airbnbBtn}>
              <Text style={styles.airbnbText}>🔗 Airbnb Listing</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Property Info */}
        <View style={styles.infoSection}>
          <Text style={styles.propertyName}>{property.name}</Text>
          <Text style={styles.propertyLocation}>{property.location}</Text>

          <View style={styles.specsCard}>
            {[
              { icon: '🛏', label: `${property.bedrooms} Bedrooms` },
              { icon: '🚿', label: `${property.bathrooms} Bathrooms` },
              { icon: '□', label: `${property.areaSqm} sqm` },
              { icon: '⌂', label: property.propertyType },
            ].map((s) => (
              <View key={s.label} style={styles.specItem}>
                <Text style={styles.specIcon}>{s.icon}</Text>
                <Text style={styles.specLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Token Progress */}
          <View style={styles.tokenCard}>
            <View style={styles.tokenHeader}>
              <Text style={styles.tokenLabel}>Available Tokens</Text>
              <Text style={styles.tokenCount}>{property.tokensAvailable.toLocaleString()}/{property.totalTokens.toLocaleString()} tokens left</Text>
            </View>
            <ProgressBar value={tokensSold} max={property.totalTokens} height={10} />
            <Text style={styles.tokenOwned}>0 tokens owned (0%)</Text>
          </View>

          {/* Yield Info */}
          <View style={styles.yieldCard}>
            <View style={styles.yieldItem}>
              <Text style={styles.yieldLabel}>ERY (Annual) ⓘ</Text>
              <Text style={styles.yieldValue}>{property.eryAnnual}%</Text>
            </View>
            <View style={styles.yieldDivider} />
            <View style={styles.yieldItem}>
              <Text style={styles.yieldLabel}>ECA (Annual) ⓘ</Text>
              <Text style={styles.yieldValue}>{property.ecaAnnual}%</Text>
            </View>
          </View>

          {/* Investment Simulator */}
          <View style={styles.simulatorCard}>
            <Text style={styles.simulatorText}>
              If you had invested 1,000 tokens, you could have earned an estimated annual return of:
            </Text>
            <Text style={styles.simulatorAmount}>
              {formatIDR(1000 * property.tokenPriceIdr * (property.eryAnnual / 100))}
            </Text>
          </View>

          {/* Top Token Holders */}
          <View style={styles.holdersCard}>
            <View style={styles.holdersHeader}>
              <Text style={styles.holdersTitle}>👑 Top Token Holders</Text>
            </View>
            {topHolders.slice(0, 3).map((h, i) => (
              <View key={h.userId} style={styles.holderRow}>
                <View style={styles.holderRankBadge}>
                  <Text style={styles.holderRankText}>{i + 1}</Text>
                </View>
                <View style={styles.holderAvatar}>
                  <Text style={styles.holderAvatarText}>{h.username[0].toUpperCase()}</Text>
                </View>
                <View style={styles.holderInfo}>
                  <Text style={styles.holderName}>{h.username} {h.isVerified ? '✓' : ''}</Text>
                  <Text style={styles.holderUserId}>ID: {h.userId}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.viewMoreBtn}>
              <Text style={styles.viewMoreText}>View more ∨</Text>
            </TouchableOpacity>
          </View>

          {/* Yield Chart */}
          <Text style={styles.chartTitle}>Monthly annualized Net Rental Yields</Text>
          <View style={styles.chartPlaceholder}>
            {yieldHistory.length > 0 ? (
              <View style={styles.chartBars}>
                {yieldHistory.map((d, i) => (
                  <View key={i} style={[styles.chartBar, { height: `${d.annualizedYield * 6}%` }]} />
                ))}
              </View>
            ) : (
              <Text style={styles.chartEmpty}>No yield data yet</Text>
            )}
          </View>

          {/* Collapsible Sections */}
          <CollapsibleSection title="Details">
            <Text style={styles.detailText}>{property.description}</Text>
          </CollapsibleSection>

          <CollapsibleSection title="Financials">
            <View style={styles.financialTable}>
              <Text style={styles.financialSubtitle}>Asset Value</Text>
              <FinancialRow label="Total investment value" value={formatIDR(property.currentValueIdr)} />
              <FinancialRow label="Underlying asset price" value={formatIDR(property.currentValueIdr * 0.92)} />
              <Text style={styles.financialSubtitle}>Annual Return</Text>
              <FinancialRow label="Total annual return" value={`${property.eryAnnual + property.ecaAnnual}%`} />
              <FinancialRow label="Projected annual rental yield" value={`${property.eryAnnual}%`} />
              <FinancialRow label="Projected annual capital appreciation" value={`${property.ecaAnnual}%`} />
            </View>
          </CollapsibleSection>

          <CollapsibleSection title="Documents">
            {['Google Maps Location', 'Product & Service Information Summary', 'Ownership Documents'].map((doc) => (
              <TouchableOpacity key={doc} style={styles.docRow}>
                <Text style={styles.docIcon}>🔗</Text>
                <Text style={styles.docName}>{doc}</Text>
              </TouchableOpacity>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Market">
            <Text style={styles.detailText}>Secondary market trading coming soon.</Text>
          </CollapsibleSection>

          <CollapsibleSection title="Timeline">
            {timeline.map((t, i) => (
              <View key={t.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{t.title}</Text>
                  <Text style={styles.timelineDesc}>{t.description}</Text>
                  <Text style={styles.timelineDate}>{new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                </View>
              </View>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Blockchain">
            {blockchain && (
              <View style={styles.blockchainSection}>
                <BlockchainRow icon="📄" label="Smart Contract Address" value={`${blockchain.contractAddress?.slice(0, 10)}...${blockchain.contractAddress?.slice(-8)}`} />
                <BlockchainRow icon="🔗" label="Blockchain Network" value="Polygon PoS mainnet" />
                <BlockchainRow icon="🏠" label="Token ID" value={String(blockchain.tokenId ?? 'N/A')} />
              </View>
            )}
          </CollapsibleSection>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.sellBtn}>
          <Text style={styles.sellIcon}>💸</Text>
        </TouchableOpacity>
        <Button title="⇄ Swap" onPress={() => {}} variant="outline" style={styles.swapBtn} />
        <Button title="💰 Invest" onPress={() => setInvestVisible(true)} style={styles.investBtn} />
      </View>

      <InvestModal property={property} visible={investVisible} onClose={() => setInvestVisible(false)} />
    </SafeAreaView>
  );
}

function FinancialRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.financialRow}>
      <Text style={styles.financialLabel}>{label}</Text>
      <Text style={styles.financialValue}>{value}</Text>
    </View>
  );
}

function BlockchainRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <TouchableOpacity style={styles.blockchainRow}>
      <Text style={styles.blockchainIcon}>{icon}</Text>
      <View>
        <Text style={styles.blockchainLabel}>{label}</Text>
        <Text style={styles.blockchainValue}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backText: { fontSize: 28, color: '#fff' },
  topBarTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: '#fff' },

  gallery: { backgroundColor: '#fff' },
  mainPhoto: { height: 250, backgroundColor: Colors.primaryLight },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoText: { fontSize: Fonts.sizes.lg, color: Colors.primaryDark, fontWeight: '700' },
  thumbnailRow: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  thumbnail: { width: 70, height: 50, marginRight: Spacing.sm, borderRadius: Radius.sm, overflow: 'hidden' },
  thumbnailActive: { borderWidth: 2, borderColor: Colors.primary },
  thumbnailPlaceholder: { flex: 1, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  morePhotos: { fontWeight: '700', color: Colors.textSecondary },

  statusRow: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.base },
  airbnbBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  airbnbText: { color: Colors.primary, fontSize: Fonts.sizes.sm, fontWeight: '600' },

  infoSection: { paddingHorizontal: Spacing.base, gap: Spacing.base },
  propertyName: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  propertyLocation: { fontSize: Fonts.sizes.base, color: Colors.textSecondary },

  specsCard: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base },
  specItem: { alignItems: 'center', gap: 4 },
  specIcon: { fontSize: 20 },
  specLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },

  tokenCard: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm },
  tokenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tokenLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  tokenCount: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  tokenOwned: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '600' },

  yieldCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base },
  yieldItem: { flex: 1, alignItems: 'center', gap: 4 },
  yieldLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  yieldValue: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.primary },
  yieldDivider: { width: 1, backgroundColor: Colors.border },

  simulatorCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm },
  simulatorText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, textAlign: 'center' },
  simulatorAmount: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.primary, textAlign: 'center' },

  holdersCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, gap: Spacing.sm },
  holdersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  holdersTitle: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  holderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: Colors.border },
  holderRankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  holderRankText: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: '#fff' },
  holderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  holderAvatarText: { color: '#fff', fontWeight: '700' },
  holderInfo: { flex: 1 },
  holderName: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary },
  holderUserId: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  viewMoreBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  viewMoreText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },

  chartTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  chartPlaceholder: { height: 150, backgroundColor: Colors.surface, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', width: '100%', paddingHorizontal: Spacing.base, gap: 4 },
  chartBar: { flex: 1, backgroundColor: Colors.primary, borderRadius: 2, opacity: 0.7 },
  chartEmpty: { color: Colors.textMuted, fontSize: Fonts.sizes.sm },

  section: { borderRadius: Radius.lg, backgroundColor: Colors.surface, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base },
  sectionTitle: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.primary },
  sectionArrow: { fontSize: 20, color: Colors.primary },
  sectionBody: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.base },
  detailText: { fontSize: Fonts.sizes.base, color: Colors.textSecondary, lineHeight: 24 },

  financialTable: { gap: Spacing.sm },
  financialSubtitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.primary, marginTop: Spacing.sm },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: Colors.border },
  financialLabel: { fontSize: Fonts.sizes.sm, color: Colors.primary, flex: 1, fontWeight: '600' },
  financialValue: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary, fontWeight: '600' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  docIcon: { fontSize: 18 },
  docName: { fontSize: Fonts.sizes.base, color: Colors.textPrimary },

  timelineItem: { flexDirection: 'row', gap: Spacing.md, paddingBottom: Spacing.base },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, marginTop: 4 },
  timelineContent: { flex: 1, gap: 2 },
  timelineTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.textPrimary },
  timelineDesc: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  timelineDate: { fontSize: Fonts.sizes.xs, color: Colors.primary },

  blockchainSection: { gap: Spacing.sm },
  blockchainRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  blockchainIcon: { fontSize: 24 },
  blockchainLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.textPrimary },
  blockchainValue: { fontSize: Fonts.sizes.sm, color: Colors.primary },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.base, backgroundColor: '#fff', borderTopWidth: 1, borderColor: Colors.border },
  sellBtn: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  sellIcon: { fontSize: 20 },
  swapBtn: { flex: 1 },
  investBtn: { flex: 2 },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.base },
  modalTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
  modalPrice: { fontSize: Fonts.sizes.base, color: Colors.textSecondary },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  amountBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  amountBtnText: { fontSize: Fonts.sizes.xl, color: Colors.primary, fontWeight: '700' },
  amountValue: { fontSize: Fonts.sizes.xxxl, fontWeight: '800', color: Colors.textPrimary },
  totalCost: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
});
