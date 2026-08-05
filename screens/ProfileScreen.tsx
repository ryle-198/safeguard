import { View, Text, Image, ScrollView, Pressable, StyleSheet, Switch } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';

const ASSETS = {
  headerShieldIcon: require('../assets/shield.png'),
  accountIcon: require('../assets/contactAvatar.png'),
  editIcon: require('../assets/editIcon.png'),
  contactHeaderIcon: require('../assets/mapThumbnail.png'), // TODO: likely wrong asset - should probably be a small heart/pin icon, not the map preview image
  contactAvatarIcon: require('../assets/contactAvatar.png'),
  homeIconOutline: require('../assets/homeIconOutline.png'),
  mapThumbnail: 'https://www.figma.com/api/mcp/asset/a70a5f5b-dc82-471e-9f9a-e7f27abe8b81.png',
  bellIcon: require('../assets/bellIcon.png'),
  signOutIcon: 'https://www.figma.com/api/mcp/asset/2b80d8ef-7e23-4a7d-90b2-49ca7e7e1ea4.svg',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const [emergencyAlertsEnabled, setEmergencyAlertsEnabled] = useState<boolean>(true);

  const handleSignOut = (): void => {
    // TODO: clear the stored JWT (expo-secure-store) and reset navigation to Login.
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleDeleteAccount = (): void => {
    // TODO: confirmation dialog and DELETE /api/resident/me call once that endpoint exists.
  };

  return (
    <View style={styles.root}>
      {/* Header - Top Navigation */}
      <HeaderBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar} />
            <Pressable style={styles.avatarEditButton}>
              <Image source={ASSETS.editIcon} style={styles.avatarEditIcon} />
            </Pressable>
          </View>
          {/* TODO: replace with the actual logged-in resident's name/id from GET /api/resident/me */}
          <Text style={styles.name}>John Doe</Text>
          <Text style={styles.subline}>Residential Sector 7G • ID: 8829-X</Text>
        </View>

        {/* Emergency Contact Card */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyAccentBar} />
          <View style={styles.emergencyHeaderRow}>
            <View style={styles.emergencyHeaderLeft}>
              <Image source={ASSETS.contactHeaderIcon} style={styles.emergencyHeaderIcon} />
              <Text style={styles.emergencyLabel}>EMERGENCY CONTACT</Text>
            </View>
            <Pressable onPress={() => navigation.navigate('EmergencyContacts')}>
              <Text style={styles.addButton}>+</Text>
            </Pressable>
          </View>

          {/* TODO: map over real contacts from GET /api/resident/emergency-contacts
              instead of this static entry */}
          <View style={styles.contactRow}>
            <View style={styles.contactAvatar}>
              <Image source={ASSETS.contactAvatarIcon} style={styles.contactAvatarIcon} />
            </View>
            <View>
              <Text style={styles.contactName}>Jane Doe</Text>
              <Text style={styles.contactMeta}>+27 12 345 6789 • Spouse</Text>
            </View>
          </View>
        </View>

        {/* Home Address Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Image source={ASSETS.homeIconOutline} style={styles.cardHeaderIcon} />
            <Text style={styles.cardLabel}>HOME ADDRESS</Text>
          </View>
          {/* TODO: pull from the resident's saved home address (set in
              SetLocationScreen / GET /api/resident/me) instead of hardcoding */}
          <Text style={styles.addressLine1}>742 Evergreen Terrace</Text>
          <Text style={styles.addressLine2}>Springfield, NT 49007</Text>
          <Image source={{ uri: ASSETS.mapThumbnail }} style={styles.mapThumbnail} />
        </View>

        {/* Notification Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Image source={ASSETS.bellIcon} style={styles.cardHeaderIcon} />
            <Text style={styles.cardLabel}>NOTIFICATIONS</Text>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text style={styles.toggleTitle}>Emergency Alerts</Text>
              <Text style={styles.toggleSubtitle}>Immediate sirens and push notifications</Text>
            </View>
            <Switch
              value={emergencyAlertsEnabled}
              onValueChange={setEmergencyAlertsEnabled}
              trackColor={{ true: colors.toggleTrackActive, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.divider} />
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Image source={{ uri: ASSETS.signOutIcon }} style={styles.signOutIcon} />
            <Text style={styles.signOutText}>SIGN OUT OF SAFEGUARD</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteText}>DELETE RESIDENT ACCOUNT</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNavBar active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.profileBackground,
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
    fontSize: typography.wordmark.fontSize,
    lineHeight: typography.wordmark.lineHeight,
    letterSpacing: typography.wordmark.letterSpacing,
    color: colors.primary,
  },
  accountIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    backgroundColor: colors.avatarBackground,
    borderWidth: 4,
    borderColor: colors.cardBackground,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    backgroundColor: colors.accentRed,
    borderWidth: 2,
    borderColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarEditIcon: {
    width: 13.5,
    height: 13.5,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  name: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.3,
    color: colors.profileHeading,
  },
  subline: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emergencyCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: 17,
    gap: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  emergencyAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accentRed,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emergencyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emergencyHeaderIcon: {
    width: 16,
    height: 24,
    resizeMode: 'contain',
  },
  emergencyLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    color: colors.accentRed,
    textTransform: 'uppercase',
  },
  addButton: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 32,
    lineHeight: 32,
    color: colors.accentRed,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.avatarBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  contactName: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.profileHeading,
  },
  contactMeta: {
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
    padding: 17,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeaderIcon: {
    width: 16,
    height: 20,
    resizeMode: 'contain',
  },
  cardLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  addressLine1: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.profileHeading,
    marginTop: spacing.xs,
  },
  addressLine2: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  mapThumbnail: {
    width: '100%',
    height: 104,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextGroup: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.profileHeading,
  },
  toggleSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.dividerBorder,
    marginTop: spacing.sm,
  },
  dangerZone: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  signOutButton: {
    height: 58,
    borderRadius: radii.md,
    backgroundColor: colors.dangerZoneBackground,
    borderWidth: 1,
    borderColor: colors.dangerZoneBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  signOutIcon: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
  },
  signOutText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.navInactiveText,
  },
  deleteButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.label.fontSize,
    lineHeight: 18,
    letterSpacing: 1.2,
    color: colors.deleteRed,
    textTransform: 'uppercase',
  },
});