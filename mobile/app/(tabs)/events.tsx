import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors, Fonts, Spacing, Radius } from '../../constants/colors';
import { eventsApi } from '../../services/api';

export default function EventsScreen() {
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list().then((r) => r.data.data),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Events</Text>
      <FlatList
        data={events}
        keyExtractor={(e: any) => e.id}
        renderItem={({ item }: any) => (
          <View style={styles.card}>
            <View style={styles.eventImage} />
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventDate}>{item.date}</Text>
              <Text style={styles.eventDesc}>{item.description}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyText}>No events at this time</Text>
            <Text style={styles.emptySubtext}>Check back soon for upcoming events</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: Fonts.sizes.xxl, fontWeight: '800', color: Colors.textPrimary, padding: Spacing.base },
  card: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  eventImage: { width: 100, backgroundColor: Colors.primaryLight },
  eventInfo: { flex: 1, padding: Spacing.md, gap: 4 },
  eventTitle: { fontSize: Fonts.sizes.base, fontWeight: '700', color: Colors.textPrimary },
  eventDate: { fontSize: Fonts.sizes.xs, color: Colors.primary },
  eventDesc: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 100, gap: Spacing.sm },
  emptyIcon: { fontSize: 48, color: Colors.textMuted },
  emptyText: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary },
  emptySubtext: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
});
