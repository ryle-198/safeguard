import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import GuardBottomNavBar from '../components/GuardBottomNavBar';
import { supabase } from '../lib/supabase';

const ASSETS = {
  headerShieldIcon: require('../assets/shield.png'),
};

type Props = NativeStackScreenProps<RootStackParamList, 'GuardHome'>;

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type GuardAvailability = 'OFF_DUTY' | 'AVAILABLE' | 'ON_BREAK';

// Matches the alert_status enum in the Postgres schema exactly.
type AlertStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'RESOLVED'
  | 'CANCELLED';

const TERMINAL_STATUSES: AlertStatus[] = ['RESOLVED', 'CANCELLED'];

interface GuardRow {
  verification_status: VerificationStatus;
  availability: GuardAvailability;
  shift_started_at: string | null;
  patrol_zone_id: number | null;
}

interface GuardAlertSummary {
  id: string;
  status: AlertStatus;
  triggeredAt: string;
}

// Shared with GuardAlertsScreen/GuardActiveAlertScreen - keep wording
// in sync if this changes.
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

export default function GuardHomeScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [guard, setGuard] = useState<GuardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [activeAlert, setActiveAlert] = useState<GuardAlertSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<GuardAlertSummary[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  /**
   * Holds the Expo location watcher while the guard is on shift.
   */
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  /**
   * Load the guard's profile and guard record.
   */
  const loadGuard = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const [
        { data: profile, error: profileError },
        { data: guardRow, error: guardError },
      ] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),

        supabase
          .from('guards')
          .select('verification_status, availability, shift_started_at, patrol_zone_id')
          .eq('user_id', user.id)
          .single(),
      ]);

      if (profileError) {
        console.error('Failed to load guard profile:', profileError.message);
      } else {
        setFullName(profile?.full_name ?? '');
      }

      if (guardError) {
        console.error('Failed to load guard record:', guardError.message);
      } else {
        setGuard(guardRow as GuardRow);
      }
    } catch (error) {
      console.error('Unexpected error loading guard home:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load alerts assigned to this guard. Splits them into:
   *  - activeAlert: the most recent non-terminal alert (if any)
   *  - recentAlerts: up to 5 terminal (resolved/cancelled) alerts
   */
  const loadGuardAlerts = useCallback(async () => {
    setLoadingAlerts(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('alerts')
        .select('id, status, triggered_at')
        .eq('guard_id', user.id)
        .order('triggered_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load guard alerts:', error.message);
        return;
      }

      const summaries: GuardAlertSummary[] = (data ?? []).map((alert: any) => ({
        id: String(alert.id),
        status: (alert.status ?? 'PENDING') as AlertStatus,
        triggeredAt: alert.triggered_at ?? new Date().toISOString(),
      }));

      const active = summaries.find((a) => !TERMINAL_STATUSES.includes(a.status)) ?? null;
      const history = summaries.filter((a) => TERMINAL_STATUSES.includes(a.status)).slice(0, 5);

      setActiveAlert(active);
      setRecentAlerts(history);
    } catch (error) {
      console.error('Unexpected error loading guard alerts:', error);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    loadGuard();
    loadGuardAlerts();
  }, [loadGuard, loadGuardAlerts]);

  /**
   * Refresh whenever this screen regains focus (e.g. coming back from
   * GuardActiveAlert), and poll every 20s while it's the active screen
   * so a newly-dispatched alert shows up without a manual refresh.
   *
   * This is a simple MVP substitute for a Supabase realtime subscription
   * - worth upgrading to `supabase.channel(...)` once this is stable.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadGuard();
      loadGuardAlerts();
    });

    const interval = setInterval(() => {
      loadGuardAlerts();
    }, 20_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [navigation, loadGuard, loadGuardAlerts]);

  const isOnShift = guard?.availability === 'AVAILABLE' || guard?.availability === 'ON_BREAK';
  const isApproved = guard?.verification_status === 'APPROVED';

  /**
   * Save the guard's current GPS location to Supabase.
   *
   * PostGIS expects:
   * POINT(longitude latitude)
   */
  const updateGuardLocation = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return false;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = position.coords;
      const point = `POINT(${longitude} ${latitude})`;

      const { error } = await supabase
        .from('guards')
        .update({
          current_location: point,
          last_location_update: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to update guard location:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected location update error:', error);
      return false;
    }
  }, []);

  /**
   * Start foreground location tracking. The guard must grant location
   * permission and we must successfully save an initial location before
   * they become AVAILABLE.
   */
  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== Location.PermissionStatus.GRANTED) {
      Alert.alert(
        'Location permission required',
        'Safeguard needs your location while you are on shift so emergency alerts can be assigned to you.'
      );
      return false;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      Alert.alert(
        'Location services disabled',
        'Please enable location services on your device before starting your shift.'
      );
      return false;
    }

    const initialUpdate = await updateGuardLocation();

    if (!initialUpdate) {
      Alert.alert(
        'Could not get your location',
        'Your shift could not be started because your current location could not be saved.'
      );
      return false;
    }

    locationSubscription.current?.remove();
    locationSubscription.current = null;

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30_000,
        distanceInterval: 25,
      },
      async (location) => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            return;
          }

          const { latitude, longitude } = location.coords;
          const point = `POINT(${longitude} ${latitude})`;

          const { error } = await supabase
            .from('guards')
            .update({
              current_location: point,
              last_location_update: new Date().toISOString(),
            })
            .eq('user_id', user.id);

          if (error) {
            console.error('Failed to update tracked guard location:', error.message);
          }
        } catch (error) {
          console.error('Unexpected tracked location error:', error);
        }
      }
    );

    return true;
  }, [updateGuardLocation]);

  const stopLocationTracking = useCallback(() => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
  }, []);

  const handleStartShift = async () => {
    if (!isApproved) {
      Alert.alert(
        'Verification required',
        'Your guard account must be approved before you can start a shift.'
      );
      return;
    }

    setUpdating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }

      const locationStarted = await startLocationTracking();

      if (!locationStarted) {
        return;
      }

      const { error } = await supabase
        .from('guards')
        .update({
          availability: 'AVAILABLE',
          shift_started_at: new Date().toISOString(),
          shift_ended_at: null,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to start shift:', error.message);
        stopLocationTracking();
        Alert.alert('Could not start shift', 'Please try again.');
        return;
      }

      await loadGuard();
    } finally {
      setUpdating(false);
    }
  };

  const handleEndShift = async () => {
    setUpdating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      stopLocationTracking();

      const { error } = await supabase
        .from('guards')
        .update({
          availability: 'OFF_DUTY',
          shift_ended_at: new Date().toISOString(),
          current_location: null,
          last_location_update: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to end shift:', error.message);
        Alert.alert('Could not end shift', 'Please try again.');
        return;
      }

      await loadGuard();
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleBreak = async () => {
    if (!guard) {
      return;
    }

    setUpdating(true);

    const nextAvailability: GuardAvailability =
      guard.availability === 'ON_BREAK' ? 'AVAILABLE' : 'ON_BREAK';

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { error } = await supabase
        .from('guards')
        .update({ availability: nextAvailability })
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to update availability:', error.message);
        Alert.alert('Could not update availability', 'Please try again.');
        return;
      }

      await loadGuard();
    } finally {
      setUpdating(false);
    }
  };

  /**
   * Sign out. Guard state is reset to OFF_DUTY / no location first, so a
   * guard can never appear AVAILABLE-but-signed-out on another device -
   * important when the same guard account is tested across multiple
   * phones/sessions.
   */
  const handleSignOut = async () => {
    stopLocationTracking();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('guards')
          .update({
            availability: 'OFF_DUTY',
            current_location: null,
            last_location_update: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Failed to clean up guard state on sign out:', error);
    }

    await supabase.auth.signOut();
    // App.tsx auth-state listener will return the user to the login stack.
  };

  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, []);

  const formatShiftStart = (dateString: string | null) => {
    if (!dateString) {
      return null;
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatAlertTime = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dutyStatusLabel =
    guard?.availability === 'AVAILABLE'
      ? 'AVAILABLE'
      : guard?.availability === 'ON_BREAK'
      ? 'ON BREAK'
      : 'OFF DUTY';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <Image source={ASSETS.headerShieldIcon} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>SAFEGUARD</Text>
          </View>

          <Pressable onPress={handleSignOut} hitSlop={12}>
            <Text style={styles.signOutLabel}>Sign Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>
            {fullName ? `Hi, ${fullName}` : 'Hi, Guard'}
          </Text>
          <Text style={styles.roleLabel}>SECURITY GUARD</Text>
        </View>

        {!isApproved ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>
              {guard?.verification_status === 'REJECTED'
                ? 'Verification not approved'
                : 'Verification pending'}
            </Text>

            <Text style={styles.pendingBody}>
              {guard?.verification_status === 'REJECTED'
                ? 'Your application was not approved. Contact your administrator for details.'
                : "An admin needs to verify your PSIRA details before you can go on shift. We'll update this once that's done."}
            </Text>
          </View>
        ) : (
          <>
            {/* DUTY STATUS */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>DUTY STATUS</Text>

              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    guard?.availability === 'AVAILABLE' && styles.statusDotAvailable,
                  ]}
                />
                <Text style={styles.statusValue}>{dutyStatusLabel}</Text>
              </View>

              {guard?.shift_started_at && isOnShift ? (
                <Text style={styles.metaText}>
                  Shift started {formatShiftStart(guard.shift_started_at)}
                </Text>
              ) : null}

              <Text style={styles.metaText}>
                Zone {guard?.patrol_zone_id ?? 'Not assigned'}
              </Text>

              <View style={styles.buttonGroup}>
                {isOnShift ? (
                  <>
                    <Pressable
                      style={[styles.primaryButton, updating && styles.buttonDisabled]}
                      onPress={handleEndShift}
                      disabled={updating}
                    >
                      <Text style={styles.primaryButtonLabel}>
                        {updating ? 'UPDATING...' : 'END SHIFT'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.secondaryButton, updating && styles.buttonDisabled]}
                      onPress={handleToggleBreak}
                      disabled={updating}
                    >
                      <Text style={styles.secondaryButtonLabel}>
                        {guard?.availability === 'ON_BREAK'
                          ? 'RESUME AVAILABILITY'
                          : 'TAKE A BREAK'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={[styles.primaryButton, updating && styles.buttonDisabled]}
                    onPress={handleStartShift}
                    disabled={updating}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {updating ? 'UPDATING...' : 'START SHIFT'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* INCOMING ALERT */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACTIVE INCIDENT</Text>

              {loadingAlerts ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : activeAlert ? (
                <Pressable
                  style={styles.alertBanner}
                  onPress={() =>
                    navigation.navigate('GuardActiveAlert', { alertId: activeAlert.id })
                  }
                >
                  <View style={styles.alertBannerText}>
                    <Text style={styles.alertBannerTitle}>
                      {statusTitle(activeAlert.status)}
                    </Text>
                    <Text style={styles.alertBannerMeta}>
                      {formatAlertTime(activeAlert.triggeredAt)}
                    </Text>
                  </View>

                  <Text style={styles.alertBannerAction}>VIEW →</Text>
                </Pressable>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No active alerts right now.</Text>
                </View>
              )}
            </View>

            {/* RECENT ACTIVITY */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>

              {loadingAlerts ? null : recentAlerts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No past incidents yet.</Text>
                </View>
              ) : (
                recentAlerts.map((alert) => (
                  <View key={alert.id} style={styles.feedItem}>
                    <Text style={styles.feedItemTitle}>{statusTitle(alert.status)}</Text>
                    <Text style={styles.feedItemMeta}>
                      {alert.status} • {formatAlertTime(alert.triggeredAt)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <GuardBottomNavBar active="Home" />
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

  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  headerIcon: {
    width: 16,
    height: 20,
    resizeMode: 'contain',
  },

  headerTitle: {
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.5,
    color: colors.primary,
  },

  signOutLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    color: colors.primary,
  },

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 32,
  },

  greetingBlock: {
    gap: 2,
  },

  greeting: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 24,
    color: colors.headingDark,
  },

  roleLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  pendingCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },

  pendingTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.headingDark,
  },

  pendingBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },

  card: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  cardLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textSecondary,
  },

  statusDotAvailable: {
    backgroundColor: colors.statusOnline,
    shadowColor: colors.statusOnline,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  statusValue: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 20,
    color: colors.textPrimary,
  },

  metaText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },

  buttonGroup: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  primaryButton: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  secondaryButton: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  section: {
    gap: spacing.sm,
  },

  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },

  loadingCard: {
    minHeight: 80,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
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

  alertBanner: {
    backgroundColor: colors.sosSection,
    borderWidth: 2,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  alertBannerText: {
    gap: 2,
  },

  alertBannerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
  },

  alertBannerMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },

  alertBannerAction: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },

  feedItem: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.md,
    gap: 2,
  },

  feedItemTitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },

  feedItemMeta: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
  },
});