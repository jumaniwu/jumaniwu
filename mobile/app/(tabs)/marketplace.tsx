import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, SafeAreaView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { propertiesApi } from '../../services/api';
import { Property } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

function PropertyListCard({ property }: { property: Property }) {
  const isRunningOut = property.status === 'running_out';
  const tokensSold = property.totalTokens - property.tokensAvailable;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/property/${property.id}`)}
      activeOpacity={0.9}
    >
      {/* Image area */}
      <View style={styles.imageArea}>
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imageName}>{property.name}</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText}>{property.location}</Text>
          </View>
        </View>
        {isRunningOut && (
          <View style={styles.runningOutBadgeAbs}>
            <Text style={styles.runningOutText}>Running Out Soon</Text>
          </View>
        )}
        {/* Image nav arrows */}
        <TouchableOpacity style={[styles.imgNav, styles.imgNavLeft]}><Text style={styles.imgNavText}>‹</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.imgNav, styles.imgNavRight]}><Text style={styles.imgNavText}>›</Text></TouchableOpacity>
        {/* Specs row */}
        <View style={styles.specsRow}>
          <Text style={styles.specText}>🛏 {property.bedrooms}</Text>
          <Text style={styles.specText}>🚿 {property.bathrooms}</Text>
          <Text style={styles.specText}>□ {property.areaSqm}sqm</Text>
        </View>
        {/* Token progress */}
        <View style={styles.tokenProgress}>
          <Text style={styles.tokenProgressText}>{tokensSold.toLocaleString()}/{property.totalTokens.toLocaleString()}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <ProgressBar
          value={tokensSold}
          max={property.totalTokens}
          showLabel={false}
          height={6}
        />
        <View style={styles.yieldRow}>
          <View style={styles.yieldItem}>
            <Text style={styles.yieldLabel}>ERY ⓘ</Text>
            <Text style={styles.yieldValue}>{property.eryAnnual}%</Text>
          </View>
          {property.aryAnnual !== undefined && (
            <View style={styles.yieldItem}>
              <Text style={styles.yieldLabel}>ARY ⓘ</Text>
              <Text style={styles.yieldValue}>{property.aryAnnual}%</Text>
            </View>
          )}
          <Button
            title="Invest Now"
            onPress={() => router.push(`/property/${property.id}`)}
            size="md"
            style={styles.investBtn}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: properties = [], refetch } = useQuery({
    queryKey: ['properties', 'list', search],
    queryFn: () => propertiesApi.list({ search }).then((r) => r.data.data),
    staleTime: 30000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() ?? 'G'}</Text>
        </View>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PropertyListCard property={item} />}
        ListHeaderComponent={
          <View>
            {/* Promo Banner */}
            <View style={styles.promoBanner}>
              <Text style={styles.promoTitle}>GRIYAKU Property Investment</Text>
              <Text style={styles.promoSub}>Start investing in premium properties today</Text>
              <TouchableOpacity style={styles.promoBtn}>
                <Text style={styles.promoBtnText}>Learn More</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Text style={styles.propertyListLabel}>Property List</Text>
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={Colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>
          </View>
        }
        contentContainerStyle={{ gap: Spacing.base, paddingBottom: Spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, backgroundColor: '#fff' },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.base },

  promoBanner: { margin: Spacing.base, borderRadius: Radius.lg, backgroundColor: Colors.primaryLight, padding: Spacing.base, borderWidth: 1, borderColor: Colors.primary },
  promoTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.primaryDark },
  promoSub: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 4 },
  promoBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md },
  promoBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: '600' },

  searchContainer: { paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.sm },
  propertyListLabel: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 44 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: Fonts.sizes.base, color: Colors.textPrimary },

  card: { backgroundColor: '#fff', marginHorizontal: Spacing.base, borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  imageArea: { height: 200, backgroundColor: Colors.primaryLight, position: 'relative' },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: Spacing.base },
  imageName: { color: Colors.primaryDark, fontWeight: '700', fontSize: Fonts.sizes.md },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationPin: { fontSize: 12 },
  locationText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  runningOutBadgeAbs: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: Colors.error, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm },
  runningOutText: { color: '#fff', fontSize: Fonts.sizes.xs, fontWeight: '600' },
  imgNav: { position: 'absolute', top: '40%', backgroundColor: 'rgba(255,255,255,0.8)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  imgNavLeft: { left: Spacing.sm },
  imgNavRight: { right: Spacing.sm },
  imgNavText: { fontSize: 18, color: Colors.textPrimary },
  specsRow: { position: 'absolute', bottom: Spacing.sm, right: Spacing.sm, flexDirection: 'row', gap: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: Radius.sm },
  specText: { fontSize: Fonts.sizes.xs, color: '#fff' },
  tokenProgress: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm },
  tokenProgressText: { fontSize: Fonts.sizes.xs, color: Colors.textPrimary, fontWeight: '600' },

  cardBody: { padding: Spacing.base, gap: Spacing.md },
  yieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  yieldItem: { gap: 2 },
  yieldLabel: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary },
  yieldValue: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.primary },
  investBtn: { marginLeft: 'auto' },
});
