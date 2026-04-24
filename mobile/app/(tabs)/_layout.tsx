import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/colors';

function TabIcon({ focused, label, icon }: { focused: boolean; label: string; icon: string }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

function MarketplaceIcon({ focused }: { focused: boolean }) {
  return (
    <View style={styles.marketplaceBtn}>
      <View style={[styles.marketplaceBg, focused && styles.marketplaceBgActive]}>
        <Text style={styles.marketplaceIcon}>⌂</Text>
        <View style={styles.coinBadge}>
          <Text style={styles.coinText}>$</Text>
        </View>
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>Marketplace</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Home" icon="⌂" />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Transactions" icon="☰" />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          tabBarIcon: ({ focused }) => <MarketplaceIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Events" icon="✦" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="More" icon="···" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
  },
  tabItem: { alignItems: 'center', gap: 2, paddingTop: 8 },
  tabIcon: { fontSize: 20, color: Colors.textMuted },
  tabIconActive: { color: Colors.primary },
  tabLabel: { fontSize: Fonts.sizes.xs, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: '600' },
  marketplaceBtn: { alignItems: 'center', gap: 2 },
  marketplaceBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    borderWidth: 4,
    borderColor: '#fff',
  },
  marketplaceBgActive: { backgroundColor: Colors.primary },
  marketplaceIcon: { fontSize: 24, color: Colors.textSecondary },
  coinBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { fontSize: 8, color: '#fff', fontWeight: '800' },
});
