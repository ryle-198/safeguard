import { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';

const ASSETS = {
  sosIcon: require('../assets/sosIcon.png'),
  sosRing: require('../assets/sosRing.png'),
  locationPin: require('../assets/locationPin.png'),
  manageIcon: require('../assets/manageIcon.png'),
  headerShield: require('../assets/shield.png'),
  menuIcon: 'https://www.figma.com/api/mcp/asset/c32b4532-3608-44ef-bf60-7ac472983d4f',
};

const SOS_HOLD_DURATION_MS = 3000;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [isHolding, setIsHolding] = useState(false);
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    setIsHolding(true);
    Animated.timing(pressAnim, {
      toValue: 0.94,
      duration: SOS_HOLD_DURATION_MS,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsHolding(false);
    Animated.timing(pressAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const handleSosTrigger = () => {
    // TODO: wire up to POST /api/resident/alerts on the SAFEGUARD backend
    console.log('SOS triggered');
  };

  return (
    <View style={styles.root}>
      <HeaderBar />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Indicator Section */}
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

        {/* SOS Trigger Section */}
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
                style={styles.sosButton}
              >
                <Image source={ASSETS.sosIcon} style={styles.sosIcon} />
                <Text style={styles.sosButtonLabel}>SOS</Text>
              </Pressable>
            </Animated.View>
            <Text style={styles.holdLabel}>
              {isHolding ? 'KEEP HOLDING...' : 'HOLD TO TRIGGER (3S)'}
            </Text>
          </View>

          <View style={styles.locationBadge}>
            <Image source={ASSETS.locationPin} style={styles.locationIcon} />
            {/* TODO: replace with live coords from expo-location */}
            <Text style={styles.locationText}>GPS: 34.0522° N, 118.2437° W</Text>
          </View>
        </View>

        {/* Emergency Contacts Section */}
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

          {/* TODO: map over the resident's actual emergency contacts from
              GET /api/resident/emergency-contacts instead of this static card */}
          <View style={styles.contactCard}>
            <View style={styles.contactAvatar} />
            <Text style={styles.contactText}>Sarah J. +27 12 345 6789</Text>
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <Text style={styles.feedTitle}>Recent Activity</Text>
            <Text style={styles.feedDateLabel}>TODAY</Text>
          </View>

          {/* TODO: map over real alert history from GET /api/resident/alerts/history */}
          <View style={styles.feedItemWrapper}>
            <View style={styles.feedItem}>
              <Text style={styles.feedItemTitle}>System Perimeter Check</Text>
              <Text style={styles.feedItemMeta}>All sensors operational • 08:42 AM</Text>
            </View>
          </View>
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
  header: {
    backgroundColor: colors.headerBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.headerBorder,
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
    fontSize: typography.wordmark.fontSize,
    lineHeight: typography.wordmark.lineHeight,
    letterSpacing: typography.wordmark.letterSpacing,
    color: colors.primary,
  },
  menuIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
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
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
    color: colors.textPrimary,
  },
  sosSubheading: {
    fontFamily: typography.fontFamily.regular,
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
  sosIcon: {
    width: 43,
    height: 45,
    resizeMode: 'contain',
  },
  sosButtonLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textOnPrimary,
    marginTop: spacing.xs,
  },
  holdLabel: {
    fontFamily: typography.fontFamily.regular,
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
  contactText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
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
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  feedDateLabel: {
    fontFamily: typography.fontFamily.semiBold,
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
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  feedItemMeta: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
  },
});