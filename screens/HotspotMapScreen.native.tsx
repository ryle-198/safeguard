import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Circle } from 'react-native-maps';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'HotspotMap'>;

interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  lastIncidentAt: string;
}

const INITIAL_REGION = {
  latitude: -33.9249,
  longitude: 18.4241,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Color scale: low count = amber, high count = red. Radius also scales with
// count so density reads at a glance without needing to tap each circle.
function hotspotColor(count: number, maxCount: number): string {
  const intensity = maxCount > 0 ? count / maxCount : 0;
  if (intensity > 0.66) return 'rgba(217,45,32,0.55)'; // primary red
  if (intensity > 0.33) return 'rgba(217,45,32,0.35)';
  return 'rgba(217,45,32,0.2)';
}

function hotspotRadius(count: number): number {
  // Base radius + scaling factor, capped so a single extreme outlier
  // doesn't dwarf the map.
  return Math.min(80 + count * 40, 400);
}

export default function HotspotMapScreen({ navigation }: Props) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);

  const loadHotspots = useCallback(async (days: number) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('crime_hotspots', { days_back: days });

      if (error) {
        console.error('Failed to load crime hotspots:', error.message);
        return;
      }

      const mapped: Hotspot[] = (data ?? []).map((row: any) => ({
        lat: row.grid_lat,
        lng: row.grid_lng,
        count: row.incident_count,
        lastIncidentAt: row.last_incident_at,
      }));

      setHotspots(mapped);
    } catch (err) {
      console.error('Unexpected error loading hotspots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHotspots(daysBack);
    }, [loadHotspots, daysBack])
  );

  const maxCount = hotspots.reduce((max, h) => Math.max(max, h.count), 0);
  const totalIncidents = hotspots.reduce((sum, h) => sum + h.count, 0);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Crime Hotspots</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <View style={styles.periodRow}>
        {[7, 30, 90].map((period) => (
          <Pressable
            key={period}
            style={[styles.periodChip, daysBack === period && styles.periodChipActive]}
            onPress={() => setDaysBack(period)}
          >
            <Text
              style={[styles.periodChipText, daysBack === period && styles.periodChipTextActive]}
            >
              {period} Days
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <MapView style={StyleSheet.absoluteFillObject} initialRegion={INITIAL_REGION}>
            {hotspots.map((hotspot, index) => (
              <Circle
                key={`${hotspot.lat}-${hotspot.lng}-${index}`}
                center={{ latitude: hotspot.lat, longitude: hotspot.lng }}
                radius={hotspotRadius(hotspot.count)}
                fillColor={hotspotColor(hotspot.count, maxCount)}
                strokeColor="rgba(217,45,32,0.6)"
                strokeWidth={1}
              />
            ))}
          </MapView>
        )}
      </View>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {totalIncidents} incident{totalIncidents === 1 ? '' : 's'} across {hotspots.length}{' '}
          area{hotspots.length === 1 ? '' : 's'} in the last {daysBack} days
        </Text>
      </View>
      <SafeAreaView edges={['bottom']} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.headerBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    height: 64,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backArrow: {
    fontSize: 28,
    color: colors.primary,
    width: 24,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 17,
    color: colors.textPrimary,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodChip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  periodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodChipText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: colors.textPrimary,
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBar: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  summaryText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
  },
});