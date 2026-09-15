import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radii, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from '../src/types/navigation';

const ASSETS = {
  navHome: require('../assets/navHome.png'),
  navMaps: require('../assets/navMaps.png'),
  navAlerts: require('../assets/navAlerts.png'),
  navProfile: require('../assets/navProfile.png'),
};

export type TabName = 'Home' | 'Maps' | 'Alerts' | 'Profile';

interface BottomNavBarProps {
  /** Which tab should render as active - pass the current screen's name. */
  active: TabName;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function BottomNavBar({ active }: BottomNavBarProps) {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView edges={['bottom']} style={styles.navBar}>
      <View style={styles.navRow}>
        <NavItem
          label="HOME"
          icon={ASSETS.navHome}
          active={active === 'Home'}
          onPress={() => navigation.navigate('Home')}
        />

        {/* TODO: Maps screen not built yet - wire navigation.navigate('Maps')
            once it exists and is added to RootStackParamList. */}
        <NavItem
          label="MAPS"
          icon={ASSETS.navMaps}
          active={active === 'Maps'}
          onPress={() => {}}
        />

        {/* TODO: Alerts screen not built yet - same as above. */}
        <NavItem
          label="ALERTS"
          icon={ASSETS.navAlerts}
          active={active === 'Alerts'}
          onPress={() => navigation.navigate('Alert')}
        />

        <NavItem
          label="PROFILE"
          icon={ASSETS.navProfile}
          active={active === 'Profile'}
          onPress={() => navigation.navigate('Profile')}
        />
      </View>
    </SafeAreaView>
  );
}

interface NavItemProps {
  label: string;
  icon: number; // require() result
  active: boolean;
  onPress: () => void;
}

function NavItem({ label, icon, active, onPress }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.navItem, active && styles.navItemActive]}
    >
      <Image
        source={icon}
        style={[styles.navIcon, active && styles.navIconActive]}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navBar: {
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.dangerZoneBorder,
  },
  navRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  navItemActive: {
    backgroundColor: colors.navActivePillBackground,
    borderRadius: radii.sm,
  },
  navIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: colors.navInactiveText,
  },
  navIconActive: {
    width: 16,
    height: 16,
    tintColor: colors.accentRed,
  },
  navLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 16.5,
    color: colors.navInactiveText,
    textTransform: 'uppercase',
  },
  navLabelActive: {
    color: colors.accentRed,
  },
});