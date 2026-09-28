import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'GuardActiveAlert'>;

type AlertStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'RESOLVED'
  | 'CANCELLED';

interface Coordinates {
  lat: number;
  lng: number;
}

interface AlertDetail {
  id: string;
  status: AlertStatus;
  incidentType: string | null;
  triggeredAt: string;
  location: Coordinates | null;
}

// Maps the current status to the action that advances it, per the
// alert_status enum's intended progression:
// PENDING -> ACCEPTED -> EN_ROUTE -> ARRIVED -> RESOLVED
const NEXT_STEP: Partial<
  Record<AlertStatus, { label: string; nextStatus: AlertStatus; timestampField: string }>
> = {
  PENDING: { label: 'ACCEPT ALERT', nextStatus: 'ACCEPTED', timestampField: 'accepted_at' },
  ACCEPTED: { label: 'START TRAVELLING', nextStatus: 'EN_ROUTE', timestampField: 'en_route_at' },
  EN_ROUTE: { label: 'MARK ARRIVED', nextStatus: 'ARRIVED', timestampField: 'arrived_at' },
  ARRIVED: { label: 'RESOLVE INCIDENT', nextStatus: 'RESOLVED', timestampField: 'resolved_at' },
};

function statusTitle(status: AlertStatus): string {
  switch (status) {
    case 'PENDING':
      return 'New Emergency Alert';
    case 'ACCEPTED':
      return 'Alert Accepted';
    case 'EN_ROUTE':
      return 'En Route';
    case 'ARRIVED':
      return 'On Scene';
    case 'RESOLVED':
      return 'Resolved';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Emergency Alert';
  }
}

/*
 * Parses a "POINT(lng lat)" WKT string, same format/parser used in
 * HomeScreen.tsx for the resident's saved home location. Kept as a
 * standalone function here since there's no shared utils module yet -
 * worth extracting to one if a third screen ends up needing this.
 */
function parseWktPoint(wkt: string | null): Coordinates | null {
  if (!wkt) {
    return null;
  }

  const match = wkt.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);

  if (!match) {
    return null;
  }

  const lng = Number(match[1]);
  const lat = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export default function GuardActiveAlertScreen({ navigation, route }: Props) {
  const { alertId } = route.params;

  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadAlert = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('id, status, incident_type, triggered_at, alerts_location_text')
        .eq('id', alertId)
        .single();

      if (error) {
        console.error('Failed to load alert:', error.message);
        Alert.alert('Could not load alert', 'Please try again.');
        return;
      }

      setAlert({
        id: String(data.id),
        status: (data.status ?? 'PENDING') as AlertStatus,
        incidentType: data.incident_type,
        triggeredAt: data.triggered_at,
        location: parseWktPoint(data.alerts_location_text),
      });
    } catch (error) {
      console.error('Unexpected error loading alert:', error);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAlert);
    return unsubscribe;
  }, [navigation, loadAlert]);

  const handleAdvance = async () => {
    if (!alert) {
      return;
    }

    const step = NEXT_STEP[alert.status];

    if (!step) {
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: step.nextStatus,
          [step.timestampField]: new Date().toISOString(),
        })
        .eq('id', alert.id);

      if (error) {
        console.error('Failed to update alert status:', error.message);
        Alert.alert('Could not update alert', 'Please try again.');
        return;
      }

      await loadAlert();
    } finally {
      setUpdating(false);
    }
  };

  /**
   * Naive MVP decline: unassigns this guard from the alert so it can be
   * picked up by dispatch again later. This does NOT re-run
   * nearest_available_guard() automatically - that's a future
   * enhancement (e.g. a retry job or a "redispatch" RPC).
   */
  const handleDecline = async () => {
  if (!alert) {
    return;
  }

  setUpdating(true);

  try {
    const { error } = await supabase.rpc('decline_assigned_alert', {
      alert_id: Number(alert.id),
    });

    if (error) {
      console.error('Failed to decline alert:', error.message);
      Alert.alert('Could not decline alert', 'Please try again.');
      return;
    }

    navigation.navigate('GuardHome');
  } finally {
    setUpdating(false);
  }
};

  const formatTime = (dateString: string | null) => {
    if (!dateString) {
      return '';
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLocation = (location: Coordinates | null) => {
    if (!location) {
      return 'Location unavailable';
    }

    const latDirection = location.lat >= 0 ? 'N' : 'S';
    const lngDirection = location.lng >= 0 ? 'E' : 'W';

    return `${Math.abs(location.lat).toFixed(4)}° ${latDirection}, ${Math.abs(
      location.lng
    ).toFixed(4)}° ${lngDirection}`;
  };

  if (loading || !alert) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const step = NEXT_STEP[alert.status];
  const isClosed = alert.status === 'RESOLVED' || alert.status === 'CANCELLED';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backLabel}>← Back</Text>
          </Pressable>

          <Text style={styles.headerTitle}>ACTIVE INCIDENT</Text>

          <View style={{ width: 48 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.alertHeading}>EMERGENCY ALERT</Text>

          <Text style={styles.cardLabel}>STATUS</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusValue}>{statusTitle(alert.status)}</Text>
          </View>

          <Text style={styles.cardLabel}>LOCATION</Text>
          <Text style={styles.metaText}>{formatLocation(alert.location)}</Text>

          <Text style={styles.cardLabel}>TRIGGERED</Text>
          <Text style={styles.metaText}>{formatTime(alert.triggeredAt)}</Text>

          <Text style={styles.cardLabel}>INCIDENT TYPE</Text>
          <Text style={styles.metaText}>{alert.incidentType ?? 'Emergency'}</Text>
        </View>

        {isClosed ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              This incident is {alert.status.toLowerCase()}. No further action is needed.
            </Text>
          </View>
        ) : (
          <>
            {step ? (
              <Pressable
                style={[styles.primaryButton, updating && styles.buttonDisabled]}
                onPress={handleAdvance}
                disabled={updating}
              >
                <Text style={styles.primaryButtonLabel}>
                  {updating ? 'UPDATING...' : step.label}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.declineButton, updating && styles.buttonDisabled]}
              onPress={handleDecline}
              disabled={updating}
            >
              <Text style={styles.declineButtonLabel}>DECLINE / UNASSIGN</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
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

  backLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    color: colors.primary,
  },

  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 32,
  },

  card: {
    backgroundColor: colors.sosSection,
    borderWidth: 2,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  alertHeading: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  cardLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  statusValue: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 18,
    color: colors.textPrimary,
  },

  metaText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    color: colors.textPrimary,
  },

  primaryButton: {
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  declineButton: {
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  declineButtonLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  emptyCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
  },

  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
});