import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapContainer, TileLayer, AttributionControl, useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';
import { ensureResidentRecord } from '../lib/ensureResidentRecord';
import { geocodeAddress, reverseGeocode } from '../lib/geocoding';
import { ensureLeafletCss } from '../lib/ensureLeafletCss';

ensureLeafletCss();

/**
 * Web version of SetLocationScreen. react-native-maps can't be bundled for
 * web, so this uses react-leaflet + OpenStreetMap tiles. Same interaction as
 * SetLocationScreen.native.tsx: the map centre (under the fixed crosshair)
 * is the selected home location.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'SetHomeLocation'>;

interface Coordinates {
  lat: number;
  lng: number;
}

const INITIAL_COORDINATES: Coordinates = {
  // Change these if you want a different starting location.
  lat: -33.9249,
  lng: 18.4241,
};

const INITIAL_ZOOM = 16;
const PLACEHOLDER_ADDRESS = 'Move the map to select your home location';

const ASSETS = {
  headerShieldIcon: require('../assets/shield.png'),
  zoomInIcon: require('../assets/zoomInIcon.png'),
  zoomOutIcon: require('../assets/zoomOutIcon.png'),
  locateIcon: require('../assets/locateIcon.png'),
};

// Alert.alert is a no-op on react-native-web, so use the browser dialog.
function notify(title: string, message: string) {
  window.alert(`${title}\n\n${message}`);
}

/** Reports the map centre whenever the user (or code) finishes moving the map. */
function MapEvents({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onMoveEnd(center.lat, center.lng);
    },
  });

  return null;
}

export default function SetLocationScreen({ navigation }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);

  // Position whose address label is already known, so the move that follows
  // a search / saved-location load doesn't overwrite it with a reverse lookup.
  const resolvedRef = useRef<Coordinates | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseRequestId = useRef(0);

  const [searchText, setSearchText] = useState('');
  const [coords, setCoords] = useState<Coordinates>(INITIAL_COORDINATES);
  const [confirmedAddress, setConfirmedAddress] = useState(PLACEHOLDER_ADDRESS);
  const [hasSelection, setHasSelection] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pushed on top of something (e.g. "Change" in EditProfileScreen) = editing.
  const isEditing = navigation.canGoBack();

  const handleBack = () => {
  if (isEditing) {
    navigation.goBack();
  } else {
    navigation.navigate('Home');
  }
};

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  /*
   * Load the resident's saved home location (if any) and centre the map on it.
   */
  useEffect(() => {
    const loadExistingLocation = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

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
        if (!locationString) return;

        const match = locationString.match(
          /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i
        );
        if (!match) {
          console.warn('Could not parse existing home location:', locationString);
          return;
        }

        const lng = Number(match[1]);
        const lat = Number(match[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setCoords({ lat, lng });
        setHasSelection(true);

        if (data?.home_address_label) {
          resolvedRef.current = { lat, lng };
          setConfirmedAddress(data.home_address_label);
        }

        mapRef.current?.setView([lat, lng], INITIAL_ZOOM);
      } catch (error) {
        console.error('Unexpected error loading existing home location:', error);
      }
    };

    loadExistingLocation();
  }, []);

  /*
   * Debounced reverse geocode. Nominatim allows ~1 request/second, and the
   * request id drops responses that arrive after the map has moved again.
   */
  const resolveAddress = useCallback((lat: number, lng: number) => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);

    const requestId = ++reverseRequestId.current;
    setLoadingAddress(true);

    reverseTimer.current = setTimeout(async () => {
      let label: string | null = null;

      try {
        label = await reverseGeocode(lat, lng);
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
      }

      if (requestId !== reverseRequestId.current) return;

      setConfirmedAddress(label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setLoadingAddress(false);
    }, 600);
  }, []);

  const handleMoveEnd = useCallback(
    (lat: number, lng: number) => {
      setCoords({ lat, lng });

      const resolved = resolvedRef.current;
      if (resolved && Math.abs(resolved.lat - lat) < 1e-5 && Math.abs(resolved.lng - lng) < 1e-5) {
        return;
      }

      setHasSelection(true);
      resolveAddress(lat, lng);
    },
    [resolveAddress]
  );

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleLocateMe = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      notify('Location unavailable', 'Your browser does not support location access.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        mapRef.current?.setView([latitude, longitude], 17);
      },
      (error) => {
        console.error('Unable to get current location:', error);
        notify(
          'Location unavailable',
          'Allow location access in your browser, or search for your address instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) return;

    try {
      setLoadingAddress(true);

      const result = await geocodeAddress(query);

      if (!result) {
        notify(
          'Location not found',
          'We could not find that address. Try entering a more specific address.'
        );
        return;
      }

      // Cancel any pending reverse lookup; the search result already has a label.
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      reverseRequestId.current++;

      resolvedRef.current = { lat: result.lat, lng: result.lng };
      setCoords({ lat: result.lat, lng: result.lng });
      setHasSelection(true);
      setConfirmedAddress(result.label);

      mapRef.current?.setView([result.lat, result.lng], INITIAL_ZOOM);
    } catch (error) {
      console.error('Address search failed:', error);
      notify('Search failed', 'Unable to search for that address.');
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (saving) return;

    if (!hasSelection) {
      notify('Select a location', 'Move the map or search for your address first.');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        notify('Session expired', 'Please sign in again.');
        return;
      }

      try {
        await ensureResidentRecord(user.id);
      } catch {
        notify(
          'Setup error',
          'Your account setup is incomplete. Please try signing out and back in.'
        );
        return;
      }

      // PostGIS expects longitude first, then latitude.
      const point = `POINT(${coords.lng} ${coords.lat})`;

      const { error } = await supabase
        .from('residents')
        .update({ home_location: point, home_address_label: confirmedAddress })
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to save home address:', error.message);
        notify('Unable to save location', error.message);
        return;
      }

      if (isEditing) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    } catch (error) {
      console.error('Unexpected location save error:', error);
      notify('Something went wrong', 'Your home location could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
  <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
    <Text style={styles.backArrow}>‹</Text>
  </Pressable>

  <View style={styles.headerBrand}>
    <Image source={ASSETS.headerShieldIcon} style={styles.headerIcon} />
    <Text style={styles.wordmark}>SAFEGUARD</Text>
  </View>

  {/* Same width as the back button so the brand stays centred */}
  <View style={styles.backButton} />
</View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Headline */}
        <View style={styles.headline}>
          <Text style={styles.title}>Set Home Location</Text>
          <Text style={styles.subtitle}>
            Precision setup for emergency response teams. Your address is encrypted and only used
            for tactical dispatch.
          </Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {/* zIndex 0 creates a stacking context so Leaflet's internal pane
              z-indexes can't cover the overlays below. */}
          <View style={styles.mapLayer}>
            <MapContainer
              ref={mapRef}
              center={[INITIAL_COORDINATES.lat, INITIAL_COORDINATES.lng]}
              zoom={INITIAL_ZOOM}
              zoomControl={false}
              attributionControl={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />
              <AttributionControl position="bottomleft" />
              <MapEvents onMoveEnd={handleMoveEnd} />
            </MapContainer>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search address..."
              placeholderTextColor={colors.searchPlaceholder}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />

            {searchText.length > 0 && (
              <Pressable onPress={handleSearch} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>GO</Text>
              </Pressable>
            )}
          </View>

          {/* Fixed centre crosshair + pin. The anchor sits exactly on the map
              centre; the pin's tip touches it. */}
          <View style={styles.centerAnchor} pointerEvents="none">
            <View style={styles.crosshairReticle}>
              <View style={[styles.crosshairTick, styles.tickLeft]} />
              <View style={[styles.crosshairTick, styles.tickRight]} />
              <View style={[styles.crosshairTickVertical, styles.tickTop]} />
              <View style={[styles.crosshairTickVertical, styles.tickBottom]} />
            </View>

            <View style={styles.pinWrapper}>
              <View style={styles.pin}>
                <View style={styles.pinDot} />
              </View>
              <View style={styles.pinStem} />
            </View>
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

          {/* Map controls */}
          <View style={styles.mapControls}>
            <Pressable style={styles.mapControlButton} onPress={handleZoomIn}>
              <Image source={ASSETS.zoomInIcon} style={styles.mapControlIcon} />
            </Pressable>

            <Pressable style={styles.mapControlButton} onPress={handleZoomOut}>
              <Image source={ASSETS.zoomOutIcon} style={styles.mapControlIconWide} />
            </Pressable>

            <Pressable style={styles.locateButton} onPress={handleLocateMe}>
              <Image source={ASSETS.locateIcon} style={styles.locateIcon} />
            </Pressable>
          </View>
        </View>

        {/* Address card */}
        <View style={styles.addressCard}>
          <View style={styles.addressIconBadge}>
            <View style={styles.addressBadgeDot} />
          </View>

          <View style={styles.addressTextGroup}>
            <Text style={styles.addressLabel}>
              {loadingAddress ? 'DETERMINING ADDRESS...' : 'CONFIRMED ADDRESS'}
            </Text>
            <Text style={styles.addressText} numberOfLines={3}>
              {confirmedAddress}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              if (hasSelection) setSearchText(confirmedAddress);
            }}
          >
            <Text style={styles.editLabel}>EDIT</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable
          style={[styles.completeButton, (saving || !hasSelection) && styles.completeButtonDisabled]}
          onPress={handleCompleteSetup}
          disabled={saving}
        >
          <Text style={styles.completeButtonLabel}>
            {saving ? 'SAVING...' : isEditing ? 'SAVE ADDRESS' : 'COMPLETE SETUP'}
          </Text>
          {!saving && <Text style={styles.completeIcon}>✓</Text>}
        </Pressable>

        <Text style={styles.disclaimer}>
          By completing, you authorize SAFEGUARD to access this location during active alerts.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.headerBackground,
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

  backButton: {
  width: 24,
},
backArrow: {
  fontSize: 28,
  lineHeight: 32,
  color: colors.primary,
},
  wordmark: {
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    fontSize: typography.wordmark.fontSize,
    lineHeight: typography.wordmark.lineHeight,
    letterSpacing: typography.wordmark.letterSpacing,
    color: colors.primary,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  headline: { gap: spacing.xs },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.7,
    color: colors.headingDark,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.stepLabel,
  },

  mapContainer: {
    height: 364,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    overflow: 'hidden',
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },

  // Everything drawn over the map needs zIndex > 0 (see mapLayer).
  searchBar: {
    position: 'absolute',
    zIndex: 10,
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.coordBadgeBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  searchButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  searchButtonText: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.primary,
  },

  // Zero-size anchor exactly at the map centre.
  centerAnchor: {
    position: 'absolute',
    zIndex: 10,
    top: '50%',
    left: '50%',
    width: 0,
    height: 0,
  },
  crosshairReticle: {
    position: 'absolute',
    width: 192,
    height: 192,
    left: -96,
    top: -96,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.crosshairBorder,
  },
  crosshairTick: {
    position: 'absolute',
    height: 2,
    width: 16,
    backgroundColor: colors.crosshairLine,
    top: 94,
  },
  tickLeft: { left: 0 },
  tickRight: { right: 0 },
  crosshairTickVertical: {
    position: 'absolute',
    width: 2,
    height: 16,
    backgroundColor: colors.crosshairLine,
    left: 94,
  },
  tickTop: { top: 0 },
  tickBottom: { bottom: 0 },

  // 32px pin + 16px stem = 48px tall, tip lands on the anchor.
  pinWrapper: {
    position: 'absolute',
    left: -16,
    top: -48,
    width: 32,
    alignItems: 'center',
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
    shadowOffset: { width: 0, height: 4 },
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  pinStem: {
    width: 4,
    height: 16,
    backgroundColor: colors.primary,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.cardBackground,
  },

  // Sits above Leaflet's attribution line in the bottom-left corner.
  coordBadge: {
    position: 'absolute',
    zIndex: 10,
    bottom: spacing.lg + 16,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.coordBadgeBackground,
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
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.6,
    color: colors.headingDark,
    textTransform: 'uppercase',
  },

  mapControls: {
    position: 'absolute',
    zIndex: 10,
    bottom: spacing.lg,
    right: spacing.lg,
    gap: spacing.xs,
  },
  mapControlButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.cardBackground,
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
    shadowOffset: { width: 0, height: 4 },
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
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  addressIconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBadgeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  addressTextGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  addressLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  addressText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    color: colors.headingDark,
  },
  editLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    color: colors.primary,
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.headerBackground,
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
  },
  completeButtonDisabled: { opacity: 0.6 },
  completeButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  completeIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disclaimer: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.stepLabel,
    textAlign: 'center',
  },
});