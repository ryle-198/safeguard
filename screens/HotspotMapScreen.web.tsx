import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';
import { ensureLeafletCss } from '../lib/ensureLeafletCss';

ensureLeafletCss();

/**
 * Web version of HotspotMapScreen. react-native-maps can't be bundled for
 * web, so this uses react-leaflet + OpenStreetMap tiles. Circles are sized
 * and shaded the same way as HotspotMapScreen.native.tsx.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'HotspotMap'>;

interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  lastIncidentAt: string;
}

const INITIAL_CENTER: [number, number] = [-33.9249, 18.4241];
const INITIAL_ZOOM = 12;
const HOTSPOT_RED = '#D92D20'; // colors.primary

// Fill opacity scales with count relative to the busiest area.
function hotspotFillOpacity(count: number, maxCount: number): number {
  const intensity = maxCount > 0 ? count / maxCount : 0;
  if (intensity > 0.66) return 0.55;
  if (intensity > 0.33) return 0.35;
  return 0.2;
}

// Metres. Base radius + scaling, capped so one outlier doesn't dwarf the map.
function hotspotRadius(count: number): number {
  return Math.min(80 + count * 40, 400);
}

/** Zooms the map to fit all hotspots whenever the data changes. */
function FitBounds({ hotspots }: { hotspots: Hotspot[] }) {
  const map = useMap();

  useEffect(() => {
    if (hotspots.length === 0) return;

    const bounds = latLngBounds(hotspots.map((h) => [h.lat, h.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [hotspots, map]);

  return null;
}

export default function HotspotMapScreen({ navigation }: Props) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);

  // Ignore responses from an earlier period if the user switches quickly.
  const requestId = useRef(0);

  const loadHotspots = useCallback(async (days: number) => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('crime_hotspots', { days_back: days });

      if (id !== requestId.current) return;

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
      if (id === requestId.current) setLoading(false);
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
              {period}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.mapContainer}>
        {/* zIndex 0 creates a stacking context so Leaflet's internal pane
            z-indexes can't cover the overlays below. */}
        <View style={styles.mapLayer}>
          <MapContainer
            center={INITIAL_CENTER}
            zoom={INITIAL_ZOOM}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />

            <FitBounds hotspots={hotspots} />

            {hotspots.map((hotspot, index) => (
              <Circle
                key={`${hotspot.lat}-${hotspot.lng}-${index}`}
                center={[hotspot.lat, hotspot.lng]}
                radius={hotspotRadius(hotspot.count)}
                pathOptions={{
                  color: HOTSPOT_RED,
                  opacity: 0.6,
                  weight: 1,
                  fillColor: HOTSPOT_RED,
                  fillOpacity: hotspotFillOpacity(hotspot.count, maxCount),
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.4 }}>
                    <strong>
                      {hotspot.count} incident{hotspot.count === 1 ? '' : 's'}
                    </strong>
                    <br />
                    Last incident: {new Date(hotspot.lastIncidentAt).toLocaleDateString()}
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>
        </View>

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && hotspots.length === 0 && (
          <View style={styles.emptyPill} pointerEvents="none">
            <Text style={styles.emptyText}>No incidents in this period</Text>
          </View>
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
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  emptyPill: {
    position: 'absolute',
    zIndex: 10,
    top: spacing.lg,
    alignSelf: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  emptyText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 13,
    color: colors.textSecondary,
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