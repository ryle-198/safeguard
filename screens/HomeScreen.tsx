import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';

import * as Location from 'expo-location';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';
import { supabase } from '../lib/supabase';

const ASSETS = {
  sosIcon: require('../assets/sosIcon.png'),
  sosRing: require('../assets/sosRing.png'),
  locationPin: require('../assets/locationPin.png'),
  manageIcon: require('../assets/manageIcon.png'),
  headerShield: require('../assets/shield.png'),

  menuIcon:
    'https://www.figma.com/api/mcp/asset/c32b4532-3608-44ef-bf60-7ac472983d4f',
};

const SOS_HOLD_DURATION_MS = 2000;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface Coordinates {
  lat: number;
  lng: number;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

// Matches the alert_status enum in the Postgres schema exactly.
type AlertStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';

interface RecentAlert {
  id: string;
  title: string;
  status: AlertStatus;
  createdAt: string;
}

// Centralized so AlertScreen.tsx and HomeScreen.tsx describe the same
// statuses the same way - update both together if wording changes.
function statusTitle(status: AlertStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Emergency Alert Pending';
    case 'ACCEPTED':
      return 'Guard Assigned';
    case 'EN_ROUTE':
      return 'Guard En Route';
    case 'ARRIVED':
      return 'Guard On Scene';
    case 'RESOLVED':
      return 'Emergency Resolved';
    case 'CANCELLED':
      return 'Alert Cancelled';
    default:
      return 'Emergency Alert';
  }
}

export default function HomeScreen({ navigation }: Props) {
  const [isHolding, setIsHolding] = useState(false);
  const [isTriggeringSos, setIsTriggeringSos] = useState(false);

  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);

  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);

  const [loadingContacts, setLoadingContacts] = useState(true);

  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const pressAnim = useRef(new Animated.Value(1)).current;

  /*
   * ----------------------------------------------------
   * GET CURRENT LOCATION
   * ----------------------------------------------------
   */
  const getCurrentLocation = useCallback(async (): Promise<Coordinates | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        console.warn('Location permission was not granted.');
        return null;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        Alert.alert(
          'Location services off',
          'Please enable Location/GPS in your device settings to use SOS.'
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newCoordinates = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      setCoordinates(newCoordinates);

      return newCoordinates;
    } catch (error) {
      console.error('Failed to get current location:', error);
      Alert.alert(
        'Could not get location',
        'Make sure GPS/Location is turned on and try again.'
      );
      return null;
    }
  }, []);

  /*
   * ----------------------------------------------------
   * LOAD SAVED HOME LOCATION
   * ----------------------------------------------------
   *
   * This is used as the initial location displayed on the Home screen.
   * The actual SOS location will try to use the device's current GPS location.
   */
  const loadHomeLocation = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      /*
       * Note: we select `residents_home_location_text` (a Postgres computed
       * column defined as `ST_AsText(home_location)`) rather than the raw
       * `home_location` geography column. Selected directly, PostGIS returns
       * geography values as EWKB hex (e.g. "0101000020E6...") rather than
       * WKT, so ST_AsText() gives us a predictable "POINT(lng lat)" string
       * to parse below.
       */
      const { data, error } = await supabase
        .from('residents')
        .select('residents_home_location_text, home_address_label')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load home location:', error.message);
        return;
      }

      if (!data?.residents_home_location_text) {
        return;
      }

      const locationString = data.residents_home_location_text;

      const match = locationString.match(
        /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i
      );

      if (!match) {
        console.warn('Could not parse saved home location:', locationString);
        return;
      }

      const lng = Number(match[1]);
      const lat = Number(match[2]);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setCoordinates({ lat, lng });
      }
    } catch (error) {
      console.error('Unexpected home location error:', error);
    }
  }, []);

  /*
   * ----------------------------------------------------
   * LOAD EMERGENCY CONTACTS
   * ----------------------------------------------------
   */
  const loadEmergencyContacts = useCallback(async () => {
    setLoadingContacts(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('resident_id', user.id)
        .limit(3);

      if (error) {
        console.error('Failed to load emergency contacts:', error.message);
        return;
      }

      const contacts: EmergencyContact[] = (data ?? []).map((contact: any, index: number) => {
        const name = contact.name ?? contact.full_name ?? contact.contact_name ?? 'Emergency Contact';

        const phone =
          contact.phone_number ?? contact.phone ?? contact.contact_phone ?? 'No phone number';

        return {
          id: String(contact.id ?? contact.contact_id ?? index),
          name,
          phone,
        };
      });

      setEmergencyContacts(contacts);
    } catch (error) {
      console.error('Unexpected emergency contacts error:', error);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  /*
   * ----------------------------------------------------
   * LOAD RECENT ALERTS
   * ----------------------------------------------------
   */
  const loadRecentAlerts = useCallback(async () => {
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
        .select('*')
        .eq('resident_id', user.id)
        .order('triggered_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Failed to load alert history:', error.message);
        return;
      }

      const alerts: RecentAlert[] = (data ?? []).map((alert: any, index: number) => {
        const status: AlertStatus = alert.status ?? 'PENDING';

        return {
          id: String(alert.id ?? index),
          title: statusTitle(status),
          status,
          createdAt: alert.triggered_at ?? new Date().toISOString(),
        };
      });

      setRecentAlerts(alerts);
    } catch (error) {
      console.error('Unexpected alert history error:', error);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  /*
   * ----------------------------------------------------
   * INITIAL DATA LOAD
   * ----------------------------------------------------
   */
  useEffect(() => {
    loadHomeLocation();
    loadEmergencyContacts();
    loadRecentAlerts();
  }, [loadHomeLocation, loadEmergencyContacts, loadRecentAlerts]);

  /*
   * ----------------------------------------------------
   * REFRESH WHEN HOME SCREEN BECOMES ACTIVE
   * ----------------------------------------------------
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadEmergencyContacts();
      loadRecentAlerts();
    });

    return unsubscribe;
  }, [navigation, loadEmergencyContacts, loadRecentAlerts]);

  /*
   * ----------------------------------------------------
   * SOS PRESS START / RELEASE
   * ----------------------------------------------------
   */
  const handlePressIn = () => {
    if (isTriggeringSos) {
      return;
    }

    setIsHolding(true);

    Animated.timing(pressAnim, {
      toValue: 0.94,
      duration: SOS_HOLD_DURATION_MS,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsHolding(false);

    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  /*
   * ----------------------------------------------------
   * SOS TRIGGER
   * ----------------------------------------------------
   */
  const handleSosTrigger = async () => {
    if (isTriggeringSos) {
      return;
    }

    setIsTriggeringSos(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Not signed in', 'Please sign in again before triggering an emergency alert.');
        return;
      }

      const currentLocation = await getCurrentLocation();

      if (!currentLocation && !coordinates) {
        Alert.alert(
          'Location unavailable',
          'SAFEGUARD could not determine your location. Please enable location services and try again.'
        );
        return;
      }

      const alertCoordinates = currentLocation ?? coordinates;

      if (!alertCoordinates) {
        Alert.alert('Location unavailable', 'No location is available for this emergency alert.');
        return;
      }

      // PostGIS expects POINT(longitude latitude)
      const point = `POINT(${alertCoordinates.lng} ${alertCoordinates.lat})`;

      const { data: alert, error } = await supabase
        .from('alerts')
        .insert({
          resident_id: user.id,
          resident_location: point,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to trigger alert:', error.message);
        Alert.alert('SOS failed', 'Your emergency alert could not be sent. Please try again.');
        return;
      }

            console.log('Emergency alert created:', alert);

      const { data: nearest, error: nearestError } = await supabase.rpc(
        'nearest_available_guard',
        { alert_location: point }
      );

      if (nearestError) {
        console.error('Failed to find nearest guard:', nearestError.message);
      } else if (nearest && nearest.length > 0) {
        const assignedGuardId = nearest[0].guard_id;

        const { error: assignmentError } = await supabase
          .from('alerts')
          .update({ guard_id: assignedGuardId })
          .eq('id', alert.id);

        if (assignmentError) {
          console.error('Failed to assign guard to alert:', assignmentError.message);
        } else {
          console.log('Alert assigned to guard:', assignedGuardId);
        }
      } else {
        console.log('No available guard found for this alert.');
      }

      await loadRecentAlerts();

      navigation.navigate('ActiveAlert', { alertId: String(alert.id) });
    } catch (error) {
      console.error('Unexpected SOS error:', error);
      Alert.alert('SOS failed', 'Something went wrong while sending the emergency alert.');
    } finally {
      setIsTriggeringSos(false);
      setIsHolding(false);

      Animated.timing(pressAnim, { toValue: 1, duration: 30, useNativeDriver: true }).start();
    }
  };

  /*
   * ----------------------------------------------------
   * FORMAT COORDINATES / ALERT TIME
   * ----------------------------------------------------
   */
  const formatCoordinates = () => {
    if (!coordinates) {
      return 'GPS: LOCATION UNAVAILABLE';
    }

    const latitudeDirection = coordinates.lat >= 0 ? 'N' : 'S';
    const longitudeDirection = coordinates.lng >= 0 ? 'E' : 'W';

    return `GPS: ${Math.abs(coordinates.lat).toFixed(4)}° ${latitudeDirection}, ${Math.abs(
      coordinates.lng
    ).toFixed(4)}° ${longitudeDirection}`;
  };

  const formatAlertTime = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.root}>
      <HeaderBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* STATUS INDICATOR */}
        <View style={styles.statusBar}>
          <View>
            <Text style={styles.statusLabel}>ENVIRONMENT STATUS</Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusValue}>Secure Area</Text>
            </View>
          </View>

          <View style={styles.zoneColumn}>
            <Text style={styles.zoneLabel}>ZONE 42-B</Text>

            <Pressable>
              <Text style={styles.reportLink}>Report Activities</Text>
            </Pressable>
          </View>
        </View>

        {/* SOS */}
        <View style={styles.sosSection}>
          <Text style={styles.sosHeading}>Emergency Response</Text>
          <Text style={styles.sosSubheading}>Immediate tactical dispatch</Text>

          <View style={styles.sosButtonWrapper}>
            <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onLongPress={handleSosTrigger}
                delayLongPress={SOS_HOLD_DURATION_MS}
                disabled={isTriggeringSos}
                style={[styles.sosButton, isTriggeringSos && styles.sosButtonDisabled]}
              >
                {isTriggeringSos ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <>
                    <Image source={ASSETS.sosIcon} style={styles.sosIcon} />
                    <Text style={styles.sosButtonLabel}>SOS</Text>
                  </>
                )}
              </Pressable>
            </Animated.View>

            <Text style={styles.holdLabel}>
              {isTriggeringSos
                ? 'SENDING ALERT...'
                : isHolding
                ? 'KEEP HOLDING...'
                : 'HOLD TO TRIGGER (3S)'}
            </Text>
          </View>

          <View style={styles.locationBadge}>
            <Image source={ASSETS.locationPin} style={styles.locationIcon} />
            <Text style={styles.locationText}>{formatCoordinates()}</Text>
          </View>
        </View>

        {/* EMERGENCY CONTACTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>EMERGENCY CONTACTS</Text>

            <Pressable
              style={styles.manageButton}
              onPress={() => navigation.navigate('EmergencyContacts')}
            >
              <Image source={ASSETS.manageIcon} style={styles.manageIcon} />
              <Text style={styles.manageText}>Manage</Text>
            </Pressable>
          </View>

          {loadingContacts ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : emergencyContacts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No emergency contacts added.</Text>

              <Pressable onPress={() => navigation.navigate('EmergencyContacts')}>
                <Text style={styles.emptyActionText}>Add a contact</Text>
              </Pressable>
            </View>
          ) : (
            emergencyContacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactAvatar} />

                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* RECENT ACTIVITY */}
        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>Recent Activity</Text>
            <Text style={styles.feedDateLabel}>TODAY</Text>
          </View>

          {loadingAlerts ? (
            <View style={styles.loadingFeed}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recentAlerts.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyFeedText}>No recent emergency activity.</Text>
            </View>
          ) : (
            recentAlerts.map((alert) => (
              <View key={alert.id} style={styles.feedItemWrapper}>
                <View style={styles.feedItem}>
                  <Text style={styles.feedItemTitle}>{alert.title}</Text>

                  <Text style={styles.feedItemMeta}>
                    {alert.status}
                    {' • '}
                    {formatAlertTime(alert.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNavBar active="Home" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  statusBar: {
    marginHorizontal: spacing.md,
    marginTop: 30,
    backgroundColor: colors.statusBarBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.statusOnline,
    shadowColor: colors.statusOnline,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  statusValue: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  zoneColumn: {
    alignItems: 'flex-end',
  },
  zoneLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  reportLink: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    color: colors.primary,
    marginTop: spacing.md,
  },
  sosSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.sosSection,
    borderWidth: 2,
    borderColor: colors.dividerBorder,
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 26,
  },
  sosHeading: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
    color: colors.textPrimary,
  },
  sosSubheading: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sosButtonWrapper: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  sosButton: {
    width: 192,
    height: 192,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.textOnPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sosButtonDisabled: {
    opacity: 0.8,
  },
  sosIcon: {
    width: 43,
    height: 45,
    resizeMode: 'contain',
  },
  sosButtonLabel: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textOnPrimary,
    marginTop: spacing.xs,
  },
  holdLabel: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.locationBadgeBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    paddingHorizontal: 17,
    paddingVertical: 9,
    marginTop: spacing.xl,
  },
  locationIcon: {
    width: 9,
    height: 12,
    resizeMode: 'contain',
  },
  locationText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.7,
    color: colors.navActiveLabel,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manageIcon: {
    width: 10.5,
    height: 10.5,
    resizeMode: 'contain',
  },
  manageText: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.navActiveLabel,
  },
  contactCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  contactAvatar: {
    width: 42,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.contactAvatarBackground,
  },
  contactDetails: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  contactPhone: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  loadingCard: {
    minHeight: 80,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  emptyActionText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.primary,
  },
  feedSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
  },
  feedHeader: {
    backgroundColor: colors.statusBarBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.dividerBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedTitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  feedDateLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  feedItemWrapper: {
    padding: spacing.lg,
  },
  feedItem: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.xs,
  },
  feedItemTitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  feedItemMeta: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
  },
  loadingFeed: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFeed: {
    padding: spacing.lg,
  },
  emptyFeedText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
});