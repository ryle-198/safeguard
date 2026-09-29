import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, ZoomControl, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { ensureLeafletCss } from '../lib/ensureLeafletCss';

ensureLeafletCss();

/**
 * Web version of ActiveAlertScreen. react-native-maps can't be bundled for
 * web, so this uses react-leaflet + OpenStreetMap tiles. Data loading,
 * realtime subscriptions, distance/ETA and cancel logic match
 * ActiveAlertScreen.native.tsx.
 *
 * Layout differs slightly: the action button sits in a bar below the map
 * instead of floating over it, so the OpenStreetMap attribution stays visible.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveAlert'>;

// Matches the alert_status enum in the Postgres schema exactly - keep in
// sync with the same type in HomeScreen.tsx and AlertScreen.tsx.
type AlertStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';

interface Coordinates {
  lat: number;
  lng: number;
}

interface AlertRow {
  id: number | string;
  status: AlertStatus;
  guard_id: string | null;
  resident_location_text: string | null;
  guard: {
    current_location_text: string | null;
    profile: { full_name: string } | null;
  } | null;
}

function parseWktPoint(wkt: string | null | undefined): Coordinates | null {
  if (!wkt) {
    return null;
  }

  const match = wkt.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);

  if (!match) {
    return null;
  }

  return { lng: Number(match[1]), lat: Number(match[2]) };
}

// Haversine great-circle distance in km.
function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// Straight-line ETA using an assumed average patrol-vehicle speed. This is
// NOT routing-based - it ignores roads, turns, and traffic. Swap in a
// directions API (Google/Mapbox) for a real driving-time ETA later.
const ASSUMED_SPEED_KMH = 30;

function estimateEtaMinutes(km: number): number {
  return Math.max(1, Math.round((km / ASSUMED_SPEED_KMH) * 60));
}

function statusTitle(status: AlertStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Finding a nearby guard…';
    case 'ACCEPTED':
      return 'Guard assigned';
    case 'EN_ROUTE':
      return 'Guard en route';
    case 'ARRIVED':
      return 'Guard has arrived';
    case 'RESOLVED':
      return 'Alert resolved';
    case 'CANCELLED':
      return 'Alert cancelled';
    default:
      return 'Emergency alert';
  }
}

const DEFAULT_CENTER: [number, number] = [-33.9249, 18.4241];
const DEFAULT_ZOOM = 15;

// Alert.alert is a no-op on react-native-web, so use browser dialogs.
function notify(title: string, message: string) {
  window.alert(`${title}\n\n${message}`);
}

/**
 * Keeps the map framed on the resident (and the guard, once assigned).
 * Padding leaves room for the status card overlaid at the top of the map.
 */
function FitView({ resident, guard }: { resident: Coordinates | null; guard: Coordinates | null }) {
  const map = useMap();

  useEffect(() => {
    if (!resident) return;

    if (guard) {
      map.fitBounds(
        latLngBounds([
          [resident.lat, resident.lng],
          [guard.lat, guard.lng],
        ]),
        { paddingTopLeft: [40, 220], paddingBottomRight: [40, 40], maxZoom: 17, animate: true }
      );
    } else {
      map.setView([resident.lat, resident.lng], DEFAULT_ZOOM);
    }
  }, [resident, guard, map]);

  return null;
}

export default function ActiveAlertScreen({ navigation, route }: Props) {
  const { alertId } = route.params;

  const [alertRow, setAlertRow] = useState<AlertRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  /*
   * ----------------------------------------------------
   * LOAD ALERT (+ assigned guard, if any)
   * ----------------------------------------------------
   */
  const fetchAlert = useCallback(async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select(
        `
        id,
        status,
        guard_id,
        resident_location_text:alerts_resident_location_text,
        guard:guards (
          current_location_text:guards_current_location_text,
          profile:profiles ( full_name )
        )
      `
      )
      .eq('id', alertId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load alert:', error.message);
      return;
    }

    if (data) {
      setAlertRow(data as unknown as AlertRow);
    }
  }, [alertId]);

  useEffect(() => {
    setLoading(true);
    fetchAlert().finally(() => setLoading(false));
  }, [fetchAlert]);

  /*
   * REALTIME: alert status / guard assignment changes.
   * Requires `alerts` in the supabase_realtime publication.
   */
  useEffect(() => {
    const channel = supabase
      .channel(`alert-${alertId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts', filter: `id=eq.${alertId}` },
        () => {
          fetchAlert();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertId, fetchAlert]);

  /*
   * REALTIME: assigned guard's live location.
   * Requires `guards` in the supabase_realtime publication.
   */
  useEffect(() => {
    if (!alertRow?.guard_id) {
      return;
    }

    const channel = supabase
      .channel(`guard-${alertRow.guard_id}-alert-${alertId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guards',
          filter: `user_id=eq.${alertRow.guard_id}`,
        },
        () => {
          fetchAlert();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [alertRow?.guard_id, alertId, fetchAlert]);

  const residentCoords = useMemo(
    () => parseWktPoint(alertRow?.resident_location_text),
    [alertRow?.resident_location_text]
  );

  const guardCoords = useMemo(
    () => parseWktPoint(alertRow?.guard?.current_location_text),
    [alertRow?.guard?.current_location_text]
  );

  const distance = useMemo(() => {
    if (!residentCoords || !guardCoords) {
      return null;
    }
    return distanceKm(residentCoords, guardCoords);
  }, [residentCoords, guardCoords]);

  const isActive = alertRow ? alertRow.status !== 'RESOLVED' && alertRow.status !== 'CANCELLED' : false;

  /*
   * CANCEL ALERT
   * Calls a SECURITY DEFINER RPC rather than updating the row directly, so
   * a resident can only ever move their own alert to CANCELLED (and only
   * while it's still active).
   */
  const handleCancel = async () => {
    if (!alertRow || cancelling) {
      return;
    }

    const confirmed = window.confirm(
      'Cancel alert?\n\nAre you sure you want to cancel this emergency alert?'
    );

    if (!confirmed) {
      return;
    }

    setCancelling(true);

    try {
      const { error } = await supabase.rpc('cancel_own_alert', { alert_id: alertId });

      if (error) {
        console.error('Failed to cancel alert:', error.message);
        notify('Could not cancel', 'Please try again.');
        return;
      }

      navigation.navigate('Home');
    } catch (error) {
      console.error('Unexpected cancel error:', error);
      notify('Could not cancel', 'Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !alertRow) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const guardName = alertRow.guard?.profile?.full_name ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        {/* zIndex 0 creates a stacking context so Leaflet's internal pane
            z-indexes can't cover the status card. */}
        <View style={styles.mapLayer}>
          <MapContainer
            center={residentCoords ? [residentCoords.lat, residentCoords.lng] : DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
            <ZoomControl position="bottomright" />

            <FitView resident={residentCoords} guard={guardCoords} />

            {residentCoords && guardCoords && (
              <Polyline
                positions={[
                  [residentCoords.lat, residentCoords.lng],
                  [guardCoords.lat, guardCoords.lng],
                ]}
                pathOptions={{ color: colors.primary, weight: 3 }}
              />
            )}

            {residentCoords && (
              <CircleMarker
                center={[residentCoords.lat, residentCoords.lng]}
                radius={11}
                pathOptions={{
                  color: '#FFFFFF',
                  weight: 3,
                  fillColor: colors.primary,
                  fillOpacity: 1,
                }}
              >
                <Popup>Your location</Popup>
              </CircleMarker>
            )}

            {guardCoords && (
              <CircleMarker
                center={[guardCoords.lat, guardCoords.lng]}
                radius={11}
                pathOptions={{
                  color: '#FFFFFF',
                  weight: 3,
                  fillColor: colors.headingDark,
                  fillOpacity: 1,
                }}
              >
                <Popup>{guardName ?? 'Guard'}</Popup>
              </CircleMarker>
            )}
          </MapContainer>
        </View>

        <View style={styles.cardWrapper}>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>{statusTitle(alertRow.status)}</Text>

            {guardName && <Text style={styles.guardName}>Guard: {guardName}</Text>}

            {distance !== null ? (
              <>
                <View style={styles.metricsRow}>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{formatDistance(distance)}</Text>
                    <Text style={styles.metricLabel}>Away</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{estimateEtaMinutes(distance)} min</Text>
                    <Text style={styles.metricLabel}>Est. arrival</Text>
                  </View>
                </View>
                <Text style={styles.estimateCaption}>
                  Estimate based on straight-line distance, not live routing.
                </Text>
              </>
            ) : (
              <Text style={styles.waitingText}>Waiting for a guard to be assigned…</Text>
            )}
          </View>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.footerInner}>
          {isActive ? (
            <Pressable
              style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.cancelButtonLabel}>Cancel Alert</Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.doneButton} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.doneButtonLabel}>Back to Home</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  mapArea: {
    flex: 1,
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  // Only the card itself should catch clicks; the rest passes through to the map.
  cardWrapper: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  statusCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  statusTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 26,
    color: colors.headingDark,
  },
  guardName: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  metricValue: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 22,
    color: colors.primary,
  },
  metricLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  estimateCaption: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  waitingText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  footerInner: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  cancelButton: {
    height: 56,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  doneButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
});