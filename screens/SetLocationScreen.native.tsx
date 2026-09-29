import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ensureResidentRecord } from '../lib/ensureResidentRecord';

import MapView, {
  Region,
} from 'react-native-maps';

import * as Location from 'expo-location';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'SetHomeLocation'
>;

interface Coordinates {
  lat: number;
  lng: number;
}

const INITIAL_COORDINATES: Coordinates = {
  // Change these if you want a different starting location.
  lat: -33.9249,
  lng: 18.4241,
};

const INITIAL_DELTA = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// TODO: temporary Figma-hosted URLs
const ASSETS = {
  headerShieldIcon: require('../assets/shield.png'),

  zoomInIcon: require('../assets/zoomInIcon.png'),
  zoomOutIcon: require('../assets/zoomOutIcon.png'),
  locateIcon: require('../assets/locateIcon.png'),

  searchIcon:
    'https://www.figma.com/api/mcp/asset/2042d3b7-b17a-4269-9eb6-03dc92a0bf28.svg',

  addressPinIcon:
    'https://www.figma.com/api/mcp/asset/e14af15c-09c4-4ef2-a68d-4ff02c739c9c.svg',

  editIcon:
    'https://www.figma.com/api/mcp/asset/96b53c87-ece8-48bc-8937-913c7d273761.svg',

  completeCheckIcon:
    'https://www.figma.com/api/mcp/asset/1fbae967-1afb-49ce-bae7-f1d685cea9d5.svg',

  pinIcon:
    'https://www.figma.com/api/mcp/asset/ab05802b-e4fb-442b-b5a2-ce6b59448937.svg',
};

export default function SetLocationScreen({
  navigation,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const [searchText, setSearchText] = useState('');

  const [coords, setCoords] = useState<Coordinates>(
    INITIAL_COORDINATES
  );

  const [confirmedAddress, setConfirmedAddress] = useState(
    'Move the map to select your home location'
  );

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [saving, setSaving] = useState(false);

  /*
   * This screen doubles as both the onboarding "set home location" step
   * and the "change home address" flow from EditProfileScreen. If it was
   * pushed on top of something (i.e. there's somewhere to go back to),
   * treat it as an edit rather than first-time setup.
   */
  const isEditing = navigation.canGoBack();

  /*
   * ----------------------------------------------------
   * LOAD EXISTING HOME LOCATION (if one is already saved)
   * ----------------------------------------------------
   * Without this, re-opening this screen (whether by backing out of
   * onboarding and returning, or via "Change" on EditProfileScreen) would
   * always reset the map to the hardcoded INITIAL_COORDINATES instead of
   * showing the resident's actual saved address.
   */
  useEffect(() => {
    const loadExistingLocation = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const { data, error } = await supabase
          .from('residents')
          .select('residents_home_location_text, home_address_label')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Failed to load existing home location:', error.message);
          return;
        }

        const locationString = data?.residents_home_location_text;

        if (!locationString) {
          return;
        }

        const match = locationString.match(
          /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i
        );

        if (!match) {
          console.warn('Could not parse existing home location:', locationString);
          return;
        }

        const lng = Number(match[1]);
        const lat = Number(match[2]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return;
        }

        setCoords({ lat, lng });

        if (data?.home_address_label) {
          setConfirmedAddress(data.home_address_label);
        }

        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lng, ...INITIAL_DELTA },
          500
        );
      } catch (error) {
        console.error('Unexpected error loading existing home location:', error);
      }
    };

    loadExistingLocation();
  }, []);

  /*
   * Convert coordinates into a readable address.
   */
  const reverseGeocode = async (
    latitude: number,
    longitude: number
  ) => {
    try {
      setLoadingAddress(true);

      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (!hasLocationPermission) {
        setConfirmedAddress(
          `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );
        return;
      }

      const address = results[0];

      const parts = [
        address.name,
        address.street,
        address.city,
        address.region,
        address.postalCode,
        address.country,
      ].filter(Boolean);

      setConfirmedAddress(parts.join(', '));
    } catch (error) {
      console.error('Reverse geocoding failed:', error);

      setConfirmedAddress(
        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  /*
   * Called when the user finishes dragging the map.
   *
   * The center of the map becomes the selected location.
   */
  const handleRegionChangeComplete = async (
    region: Region
  ) => {
    const newCoordinates = {
      lat: region.latitude,
      lng: region.longitude,
    };

    setCoords(newCoordinates);

    await reverseGeocode(
      region.latitude,
      region.longitude
    );
  };

  /*
   * Request permission and move the map to
   * the user's current device location.
   */
  const handleLocateMe = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          'Location permission required',
          'Please allow location access to use your current location.'
        );
        return;
      }

      const location =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const { latitude, longitude } =
        location.coords;

      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: INITIAL_DELTA.latitudeDelta,
        longitudeDelta: INITIAL_DELTA.longitudeDelta,
      };

      mapRef.current?.animateToRegion(
        newRegion,
        500
      );

      setCoords({
        lat: latitude,
        lng: longitude,
      });

      await reverseGeocode(
        latitude,
        longitude
      );
    } catch (error) {
      console.error(
        'Unable to get current location:',
        error
      );

      Alert.alert(
        'Location unavailable',
        'We could not determine your current location.'
      );
    }
  };

  /*
   * Zoom in.
   */
  const handleZoomIn = () => {
    mapRef.current?.getCamera().then((camera) => {
      const currentZoom =
        camera.zoom ?? 15;

      mapRef.current?.animateCamera(
        {
          ...camera,
          zoom: currentZoom + 1,
        },
        {
          duration: 250,
        }
      );
    });
  };

  /*
   * Zoom out.
   */
  const handleZoomOut = () => {
    mapRef.current?.getCamera().then((camera) => {
      const currentZoom =
        camera.zoom ?? 15;

      mapRef.current?.animateCamera(
        {
          ...camera,
          zoom: Math.max(
            currentZoom - 1,
            1
          ),
        },
        {
          duration: 250,
        }
      );
    });
  };

  /*
   * Search for an address.
   *
   * expo-location provides forward geocoding through
   * geocodeAsync().
   */
  const handleSearch = async () => {
    const query = searchText.trim();

    if (!query) {
      return;
    }

    try {
      setLoadingAddress(true);

      const results =
        await Location.geocodeAsync(query);

      if (results.length === 0) {
        Alert.alert(
          'Location not found',
          'We could not find that address. Try entering a more specific address.'
        );
        return;
      }

      const result = results[0];

      const newRegion = {
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta:
          INITIAL_DELTA.latitudeDelta,
        longitudeDelta:
          INITIAL_DELTA.longitudeDelta,
      };

      setCoords({
        lat: result.latitude,
        lng: result.longitude,
      });

      mapRef.current?.animateToRegion(
        newRegion,
        500
      );

      await reverseGeocode(
        result.latitude,
        result.longitude
      );
    } catch (error) {
      console.error(
        'Address search failed:',
        error
      );

      Alert.alert(
        'Search failed',
        'Unable to search for that address.'
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  /*
   * Save selected home location to Supabase.
   */
  const handleCompleteSetup = async () => {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Session expired',
          'Please sign in again.'
        );
        return;
      }

      try {
        await ensureResidentRecord(user.id);
      } catch {
        Alert.alert('Setup error', 'Your account setup is incomplete. Please try signing out and back in.');
        return;
      }

      /*
       * PostGIS expects longitude first,
       * then latitude.
       */
      const point = `POINT(${coords.lng} ${coords.lat})`;

      const { error } = await supabase
        .from('residents')
        .update({
          home_location: point,
          home_address_label:
            confirmedAddress,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error(
          'Failed to save home address:',
          error.message
        );

        Alert.alert(
          'Unable to save location',
          error.message
        );

        return;
      }

      if (isEditing) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error(
        'Unexpected location save error:',
        error
      );

      Alert.alert(
        'Something went wrong',
        'Your home location could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  };

  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  useEffect(() => {
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasLocationPermission(status === Location.PermissionStatus.GRANTED);

    if (status !== Location.PermissionStatus.GRANTED) {
      Alert.alert(
        'Location permission required',
        'SAFEGUARD needs location access to set your home address accurately.'
      );
    }
  })();
}, []);

  return (
    <View style={styles.root}>

      {/* Header */}
      <SafeAreaView
        edges={['top']}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <Image
              source={ASSETS.headerShieldIcon}
              style={styles.headerIcon}
            />

            <Text style={styles.wordmark}>
              SAFEGUARD
            </Text>
          </View>

          {/* <Text style={styles.stepIndicator}>
            STEP 3 OF 3
          </Text> */}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
      >

        {/* Headline */}
        <View style={styles.headline}>
          <Text style={styles.title}>
            Set Home Location
          </Text>

          <Text style={styles.subtitle}>
            Precision setup for emergency response
            teams. Your address is encrypted and only
            used for tactical dispatch.
          </Text>
        </View>

        {/* REAL MAP */}
        <View style={styles.mapContainer}>

          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude:
                INITIAL_COORDINATES.lat,
              longitude:
                INITIAL_COORDINATES.lng,
              latitudeDelta:
                INITIAL_DELTA.latitudeDelta,
              longitudeDelta:
                INITIAL_DELTA.longitudeDelta,
            }}
            mapType="standard"
            showsUserLocation={false}
            showsMyLocationButton={false}
            onRegionChangeComplete={
              handleRegionChangeComplete
            }
          />

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Image
              source={{
                uri: ASSETS.searchIcon,
              }}
              style={styles.searchIcon}
            />

            <TextInput
              style={styles.searchInput}
              placeholder="Search address or coordinates..."
              placeholderTextColor={
                colors.searchPlaceholder
              }
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />

            {searchText.length > 0 && (
              <Pressable
                onPress={handleSearch}
                style={styles.searchButton}
              >
                <Text style={styles.searchButtonText}>
                  GO
                </Text>
              </Pressable>
            )}
          </View>

          {/* Fixed Center Pin / Crosshair */}
          <View
            style={styles.pinWrapper}
            pointerEvents="none"
          >
            <View
              style={styles.crosshairReticle}
            >
              <View
                style={[
                  styles.crosshairTick,
                  styles.tickLeft,
                ]}
              />

              <View
                style={[
                  styles.crosshairTick,
                  styles.tickRight,
                ]}
              />

              <View
                style={[
                  styles.crosshairTickVertical,
                  styles.tickTop,
                ]}
              />

              <View
                style={[
                  styles.crosshairTickVertical,
                  styles.tickBottom,
                ]}
              />
            </View>

            <View style={styles.pin}>
              <Image
                source={{
                  uri: ASSETS.pinIcon,
                }}
                style={styles.pinIcon}
              />
            </View>

            <View style={styles.pinStem} />
          </View>

          {/* Coordinates */}
          <View style={styles.coordBadge}>
            <View style={styles.coordDot} />

            <Text style={styles.coordText}>
              LAT: {Math.abs(coords.lat).toFixed(4)}
              {coords.lat >= 0 ? '° N' : '° S'}
              {' | '}
              LON: {Math.abs(coords.lng).toFixed(4)}
              {coords.lng >= 0 ? '° E' : '° W'}
            </Text>
          </View>

          {/* Map Controls */}
          <View style={styles.mapControls}>

            <Pressable
              style={styles.mapControlButton}
              onPress={handleZoomIn}
            >
              <Image
                source={ASSETS.zoomInIcon}
                style={styles.mapControlIcon}
              />
            </Pressable>

            <Pressable
              style={styles.mapControlButton}
              onPress={handleZoomOut}
            >
              <Image
                source={ASSETS.zoomOutIcon}
                style={styles.mapControlIconWide}
              />
            </Pressable>

            <Pressable
              style={styles.locateButton}
              onPress={handleLocateMe}
            >
              <Image
                source={ASSETS.locateIcon}
                style={styles.locateIcon}
              />
            </Pressable>

          </View>
        </View>

        {/* Address Card */}
        <View style={styles.addressCard}>

          <View style={styles.addressIconBadge}>
            <Image
              source={{
                uri: ASSETS.addressPinIcon,
              }}
              style={styles.addressPinIcon}
            />
          </View>

          <View style={styles.addressTextGroup}>
            <Text style={styles.addressLabel}>
              {loadingAddress
                ? 'DETERMINING ADDRESS...'
                : 'CONFIRMED ADDRESS'}
            </Text>

            <Text
              style={styles.addressText}
              numberOfLines={3}
            >
              {confirmedAddress}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              setSearchText(
                confirmedAddress
              );
            }}
          >
            <Image
              source={{
                uri: ASSETS.editIcon,
              }}
              style={styles.editIcon}
            />
          </Pressable>

        </View>

      </ScrollView>

      {/* Footer */}
      <SafeAreaView
        edges={['bottom']}
        style={styles.footer}
      >
        <Pressable
          style={[
            styles.completeButton,
            saving &&
              styles.completeButtonDisabled,
          ]}
          onPress={handleCompleteSetup}
          disabled={saving}
        >
          <Text
            style={styles.completeButtonLabel}
          >
            {saving
              ? 'SAVING...'
              : isEditing
              ? 'SAVE ADDRESS'
              : 'COMPLETE SETUP'}
          </Text>

          {!saving && (
            <Image
              source={{
                uri: ASSETS.completeCheckIcon,
              }}
              style={styles.completeIcon}
            />
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          By completing, you authorize SAFEGUARD
          to access this location during active
          alerts.
        </Text>
      </SafeAreaView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor:
      colors.headerBackground,
  },

  header: {
    backgroundColor:
      colors.headerBackground,
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

  wordmark: {
    fontFamily:
      typography.fontFamily.extraBold,
    fontWeight: '800',
    fontSize:
      typography.wordmark.fontSize,
    lineHeight:
      typography.wordmark.lineHeight,
    letterSpacing:
      typography.wordmark.letterSpacing,
    color: colors.primary,
  },

  stepIndicator: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize:
      typography.label.fontSize,
    lineHeight:
      typography.label.lineHeight,
    letterSpacing:
      typography.label.letterSpacing,
    color: colors.stepLabel,
    textTransform: 'uppercase',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },

  headline: {
    gap: spacing.xs,
  },

  title: {
    fontFamily:
      typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.7,
    color: colors.headingDark,
  },

  subtitle: {
    fontFamily:
      typography.fontFamily.regular,
    fontWeight: '400',
    fontSize:
      typography.body.fontSize,
    lineHeight:
      typography.body.lineHeight,
    color: colors.stepLabel,
  },

  mapContainer: {
    height: 364,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.cardBackground,
    overflow: 'hidden',
  },

  searchBar: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:
      colors.coordBadgeBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },

  searchIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },

  searchInput: {
    flex: 1,
    fontFamily:
      typography.fontFamily.regular,
    fontWeight: '400',
    fontSize:
      typography.body.fontSize,
    color: colors.textPrimary,
  },

  searchButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  searchButtonText: {
    fontFamily:
      typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },

  pinWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    transform: [
      { translateX: -16 },
      { translateY: -16 },
    ],
  },

  crosshairReticle: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor:
      colors.crosshairBorder,
    top: -60,
    left: -80,
  },

  crosshairTick: {
    position: 'absolute',
    height: 2,
    width: 16,
    backgroundColor:
      colors.crosshairLine,
    top: 94,
  },

  tickLeft: {
    left: 0,
  },

  tickRight: {
    right: 0,
  },

  crosshairTickVertical: {
    position: 'absolute',
    width: 2,
    height: 16,
    backgroundColor:
      colors.crosshairLine,
    left: 94,
  },

  tickTop: {
    top: 0,
  },

  tickBottom: {
    bottom: 0,
  },

  pin: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  pinIcon: {
    width: 13,
    height: 17,
    resizeMode: 'contain',
  },

  pinStem: {
    width: 4,
    height: 16,
    backgroundColor: colors.primary,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.cardBackground,
  },

  coordBadge: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor:
      colors.coordBadgeBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  coordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  coordText: {
    fontFamily:
      typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.6,
    color: colors.headingDark,
    textTransform: 'uppercase',
  },

  mapControls: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    gap: spacing.xs,
  },

  mapControlButton: {
    width: 40,
    height: 40,
    backgroundColor:
      colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapControlIcon: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
  },

  mapControlIconWide: {
    width: 14,
    height: 2,
    resizeMode: 'contain',
  },

  locateButton: {
    width: 40,
    height: 40,
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  locateIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },

  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor:
      colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },

  addressIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor:
      colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressPinIcon: {
    width: 16,
    height: 20,
    resizeMode: 'contain',
  },

  addressTextGroup: {
    flex: 1,
    gap: spacing.xs,
  },

  addressLabel: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize:
      typography.label.fontSize,
    lineHeight:
      typography.label.lineHeight,
    letterSpacing:
      typography.label.letterSpacing,
    color: colors.primary,
    textTransform: 'uppercase',
  },

  addressText: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    color: colors.headingDark,
  },

  editIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor:
      colors.headerBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  completeButton: {
    height: 56,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },

  completeButtonDisabled: {
    opacity: 0.6,
  },

  completeButtonLabel: {
    fontFamily:
      typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },

  completeIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },

  disclaimer: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize:
      typography.label.fontSize,
    lineHeight:
      typography.label.lineHeight,
    letterSpacing:
      typography.label.letterSpacing,
    color: colors.stepLabel,
    textAlign: 'center',
  },
});