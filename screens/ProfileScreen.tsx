import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';
import { supabase } from '../lib/supabase';
import MembershipCard from '../components/MembershipCard';

const ASSETS = {
  headerShieldIcon: require('../assets/shield.png'),
  accountIcon: require('../assets/contactAvatar.png'),
  editIcon: require('../assets/editIcon.png'),
  contactHeaderIcon: require('../assets/mapThumbnail.png'),
  contactAvatarIcon: require('../assets/contactAvatar.png'),
  homeIconOutline: require('../assets/homeIconOutline.png'),
  mapThumbnail:
    'https://www.figma.com/api/mcp/asset/a70a5f5b-dc82-471e-9f9a-e7f27abe8b81.png',
  bellIcon: require('../assets/bellIcon.png'),
  signOutIcon:
    'https://www.figma.com/api/mcp/asset/2b80d8ef-7e23-4a7d-90b2-49ca7e7e1ea4.svg',
};

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

type EmergencyContact = {
  id: number;
  name: string;
  phone_number: string;
  relationship: string | null;
};

type ProfileData = {
  id: string;
  full_name: string;
};

type ResidentData = {
  home_address_label: string | null;
};

export default function ProfileScreen({ navigation }: Props) {
  const [emergencyAlertsEnabled, setEmergencyAlertsEnabled] =
    useState<boolean>(true);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [resident, setResident] = useState<ResidentData | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContact[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');

    try {
      // Get the currently authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setError('No authenticated user found.');
        return;
      }

      // ---------------------------------------------------------
      // Load profile
      // ---------------------------------------------------------

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(profileData);

      // ---------------------------------------------------------
      // Load resident information
      // ---------------------------------------------------------

      const {
        data: residentData,
        error: residentError,
      } = await supabase
        .from('residents')
        .select('home_address_label')
        .eq('user_id', user.id)
        .maybeSingle();

      if (residentError) {
        throw residentError;
      }

      setResident(residentData);

      // ---------------------------------------------------------
      // Load emergency contacts
      // ---------------------------------------------------------

      const {
        data: contactsData,
        error: contactsError,
      } = await supabase
        .from('emergency_contacts')
        .select(
          'id, name, phone_number, relationship'
        )
        .eq('resident_id', user.id)
        .order('id', { ascending: true });

      if (contactsError) {
        throw contactsError;
      }

      setEmergencyContacts(
        contactsData ?? []
      );
    } catch (err: any) {
      console.error(
        'Failed to load profile:',
        err
      );

      setError(
        err?.message ||
          'Failed to load profile information.'
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Reload whenever the Profile screen receives focus.
   *
   * This is useful because the user may update their
   * home location or emergency contacts elsewhere in
   * the app and then return to Profile.
   */
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const handleDeleteAccount = (): void => {
    // TODO:
    // Add confirmation dialog and account deletion
    // once the backend/account deletion flow exists.
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <HeaderBar />

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading profile...
          </Text>
        </View>

        <BottomNavBar active="Profile" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <HeaderBar />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              onPress={loadProfile}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                TRY AGAIN
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Profile Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar} />

            <Pressable
  style={styles.avatarEditButton}
  onPress={() => navigation.navigate('EditProfile')}
>
  <Image source={ASSETS.editIcon} style={styles.avatarEditIcon} />
</Pressable>
          </View>

          <Text style={styles.name}>
            {profile?.full_name || 'Resident'}
          </Text>

          <Text style={styles.subline}>
            Resident • ID:{' '}
            {profile?.id
              ? profile.id.substring(0, 8).toUpperCase()
              : 'N/A'}
          </Text>
        </View>
        <MembershipCard />

        {/* Emergency Contact Card */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyAccentBar} />

          <View style={styles.emergencyHeaderRow}>
            <View style={styles.emergencyHeaderLeft}>
              <Image
                source={ASSETS.contactHeaderIcon}
                style={styles.emergencyHeaderIcon}
              />

              <Text style={styles.emergencyLabel}>
                EMERGENCY CONTACT
              </Text>
            </View>

            <Pressable
              onPress={() =>
                navigation.navigate(
                  'EmergencyContacts'
                )
              }
            >
              <Text style={styles.addButton}>
                +
              </Text>
            </Pressable>
          </View>

          {emergencyContacts.length === 0 ? (
            <View style={styles.emptyContact}>
              <Text style={styles.emptyContactText}>
                No emergency contacts added.
              </Text>

              <Pressable
                onPress={() =>
                  navigation.navigate(
                    'EmergencyContacts'
                  )
                }
              >
                <Text style={styles.addContactText}>
                  Add an emergency contact
                </Text>
              </Pressable>
            </View>
          ) : (
            emergencyContacts.map((contact) => (
              <View
                key={contact.id}
                style={styles.contactRow}
              >
                <View style={styles.contactAvatar}>
                  <Image
                    source={ASSETS.contactAvatarIcon}
                    style={styles.contactAvatarIcon}
                  />
                </View>

                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>
                    {contact.name}
                  </Text>

                  <Text style={styles.contactMeta}>
                    {contact.phone_number}
                    {contact.relationship
                      ? ` • ${contact.relationship}`
                      : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Home Address Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Image
              source={ASSETS.homeIconOutline}
              style={styles.cardHeaderIcon}
            />

            <Text style={styles.cardLabel}>
              HOME ADDRESS
            </Text>
          </View>

          {resident?.home_address_label ? (
            <>
              <Text style={styles.addressLine1}>
                {resident.home_address_label}
              </Text>
            </>
          ) : (
            <View style={styles.noAddressContainer}>
              <Text style={styles.noAddressText}>
                No home address has been set.
              </Text>

              <Pressable
                onPress={() =>
                  navigation.navigate(
                    'SetHomeLocation'
                  )
                }
              >
                <Text style={styles.setAddressText}>
                  Set home location
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Notification Settings Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Image
              source={ASSETS.bellIcon}
              style={styles.cardHeaderIcon}
            />

            <Text style={styles.cardLabel}>
              NOTIFICATIONS
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text style={styles.toggleTitle}>
                Emergency Alerts
              </Text>

              <Text style={styles.toggleSubtitle}>
                Immediate sirens and push notifications
              </Text>
            </View>

            <Switch
              value={emergencyAlertsEnabled}
              onValueChange={
                setEmergencyAlertsEnabled
              }
              trackColor={{
                true: colors.toggleTrackActive,
                false: colors.border,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Pressable
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Image
              source={{
                uri: ASSETS.signOutIcon,
              }}
              style={styles.signOutIcon}
            />

            <Text style={styles.signOutText}>
              SIGN OUT OF SAFEGUARD
            </Text>
          </Pressable>

          <Pressable
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteText}>
              DELETE RESIDENT ACCOUNT
            </Text>
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
    fontWeight: '600',
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

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },

  errorBox: {
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#E8B4B4',
    borderRadius: radii.md,
    padding: spacing.md,
  },

  errorText: {
    color: '#B42318',
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  retryButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.accentRed,
  },

  retryText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
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
    fontWeight: '700',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.3,
    color: colors.profileHeading,
  },

  subline: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
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
    fontWeight: '600',
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    color: colors.accentRed,
    textTransform: 'uppercase',
  },

  addButton: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
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

  contactDetails: {
    flex: 1,
  },

  contactName: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.profileHeading,
  },

  contactMeta: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },

  emptyContact: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  emptyContactText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  addContactText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    color: colors.accentRed,
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
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  addressLine1: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.profileHeading,
    marginTop: spacing.xs,
  },

  addressLine2: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },

  noAddressContainer: {
    paddingVertical: spacing.sm,
  },

  noAddressText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },

  setAddressText: {
    marginTop: spacing.xs,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    color: colors.primary,
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
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.profileHeading,
  },

  toggleSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
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
    fontWeight: '400',
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
    fontWeight: '400',
    fontSize: typography.label.fontSize,
    lineHeight: 18,
    letterSpacing: 1.2,
    color: colors.deleteRed,
    textTransform: 'uppercase',
  },
});

