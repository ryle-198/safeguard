import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'SetHomeLocation'
>;

// TODO: temporary Figma-hosted URLs, expire ~7 days after export - see
// screens/LoginScreen.js for the export-and-replace steps.
const ASSETS = {
  headerShieldIcon: require('../assets/shield.png'),
  mapBackground: 'https://www.figma.com/api/mcp/asset/a0d81f4f-e34e-47d7-83db-5dfb569ddfa0.png',
  pinIcon: 'https://www.figma.com/api/mcp/asset/ab05802b-e4fb-442b-b5a2-ce6b59448937.svg',
  zoomInIcon: require('../assets/zoomInIcon.png'),
  zoomOutIcon: require('../assets/zoomOutIcon.png'),
  locateIcon: require('../assets/locateIcon.png'),
  searchIcon: 'https://www.figma.com/api/mcp/asset/2042d3b7-b17a-4269-9eb6-03dc92a0bf28.svg',
  addressPinIcon: 'https://www.figma.com/api/mcp/asset/e14af15c-09c4-4ef2-a68d-4ff02c739c9c.svg',
  editIcon: 'https://www.figma.com/api/mcp/asset/96b53c87-ece8-48bc-8937-913c7d273761.svg',
  completeCheckIcon: 'https://www.figma.com/api/mcp/asset/1fbae967-1afb-49ce-bae7-f1d685cea9d5.svg',
};

interface Coordinates {
  lat: number;
  lng: number;
}

export default function SetLocationScreen({ navigation }: Props) {
  const [searchText, setSearchText] = useState<string>('');

  // TODO: replace this entire static map with react-native-maps once that's
  // installed. Center coordinates / confirmed address should come from a
  // real MapView onRegionChange + reverse-geocoding call instead of being
  // hardcoded here.
const [coords] = useState<Coordinates>({
  lat: 40.7128,
  lng: -74.006,
});
  const [confirmedAddress] = useState<string>(
  '742 Evergreen Terrace, Springfield'
);
  const handleCompleteSetup = ():void => {
    // TODO: wire up to PUT /api/resident/me/home-address with
    // { latitude: coords.lat, longitude: coords.lng, addressLabel: confirmedAddress }.
    // For now (frontend-only phase) it just navigates straight to Home.
    navigation.navigate('Home');
  };

  return (
    <View style={styles.root}>
      {/* Header - Top Navigation */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <Image source={ASSETS.headerShieldIcon} style={styles.headerIcon} />
            <Text style={styles.wordmark}>SAFEGUARD</Text>
          </View>
          <Text style={styles.stepIndicator}>STEP 3 OF 3</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Headline Section */}
        <View style={styles.headline}>
          <Text style={styles.title}>Set Home Location</Text>
          <Text style={styles.subtitle}>
            Precision setup for emergency response teams. Your address is encrypted and only
            used for tactical dispatch.
          </Text>
        </View>

        {/* Interactive Map Container (static placeholder for now) */}
        <View style={styles.mapContainer}>
          {/* <Image source={{ uri: ASSETS.mapBackground }} style={styles.mapBackground} blurRadius={2} /> */}

          {/* Search Bar Overlay */}
          <View style={styles.searchBar}>
            <Image source={{ uri: ASSETS.searchIcon }} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address or coordinates..."
              placeholderTextColor={colors.searchPlaceholder}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* Drop Pin / Crosshair - fixed center for now */}
          <View style={styles.pinWrapper} pointerEvents="none">
            <View style={styles.crosshairReticle}>
              <View style={[styles.crosshairTick, styles.tickLeft]} />
              <View style={[styles.crosshairTick, styles.tickRight]} />
              <View style={[styles.crosshairTickVertical, styles.tickTop]} />
              <View style={[styles.crosshairTickVertical, styles.tickBottom]} />
            </View>
            <View style={styles.pin}>
              <Image source={{ uri: ASSETS.pinIcon }} style={styles.pinIcon} />
            </View>
            <View style={styles.pinStem} />
          </View>

          {/* Coordinates Feed */}
          <View style={styles.coordBadge}>
            <View style={styles.coordDot} />
            <Text style={styles.coordText}>
              LAT: {coords.lat.toFixed(4)}° N | LON: {Math.abs(coords.lng).toFixed(4)}° W
            </Text>
          </View>

          {/* Map Controls */}
          <View style={styles.mapControls}>
            <Pressable style={styles.mapControlButton}>
              <Image source={ASSETS.zoomInIcon} style={styles.mapControlIcon} />
            </Pressable>
            <Pressable style={styles.mapControlButton}>
              <Image source={ASSETS.zoomOutIcon} style={styles.mapControlIconWide} />
            </Pressable>
            <Pressable style={styles.locateButton}>
              <Image source={ASSETS.locateIcon} style={styles.locateIcon} />
            </Pressable>
          </View>
        </View>

        {/* Address Result Card */}
        <View style={styles.addressCard}>
          <View style={styles.addressIconBadge}>
            <Image source={{ uri: ASSETS.addressPinIcon }} style={styles.addressPinIcon} />
          </View>
          <View style={styles.addressTextGroup}>
            <Text style={styles.addressLabel}>CONFIRMED ADDRESS</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {confirmedAddress}
            </Text>
          </View>
          <Pressable>
            <Image source={{ uri: ASSETS.editIcon }} style={styles.editIcon} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Footer Action */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable style={styles.completeButton} onPress={handleCompleteSetup}>
          <Text style={styles.completeButtonLabel}>COMPLETE SETUP</Text>
          <Image source={{ uri: ASSETS.completeCheckIcon }} style={styles.completeIcon} />
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
  wordmark: {
    fontFamily: typography.fontFamily.extraBold,
    fontWeight: '800',
    fontSize: typography.wordmark.fontSize,
    lineHeight: typography.wordmark.lineHeight,
    letterSpacing: typography.wordmark.letterSpacing,
    color: colors.primary,
  },
  stepIndicator: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
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
  mapBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
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
    backgroundColor: colors.coordBadgeBackground,
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
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  pinWrapper: {
    position: 'absolute',
    top: '39%',
    left: '46%',
    alignItems: 'center',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  crosshairReticle: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.crosshairBorder,
    top: -60,
    left: -80,
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
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
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
    width: 20,
    height: 20,
    resizeMode: 'contain',
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