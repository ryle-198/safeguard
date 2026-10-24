import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../src/types/navigation';
import { colors, spacing, typography } from '../theme/tokens';

type GuardNav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  active: 'Home' | 'Alerts' | 'Profile';
}

/**
 * A lightweight bottom nav for the guard side of the app.
 *
 * We don't reuse the resident BottomNavBar here because it's wired to
 * resident-only route names (Home, Profile, etc). This is intentionally
 * minimal - Home / Alerts / Profile - matching the guard screens that
 * currently exist.
 */
export default function GuardBottomNavBar({ active }: Props) {
  const navigation = useNavigation<GuardNav>();

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.tab}
        onPress={() => navigation.navigate('GuardHome')}
      >
        <Text
          style={[
            styles.label,
            active === 'Home' && styles.labelActive,
          ]}
        >
          Home
        </Text>
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => navigation.navigate('GuardAlerts')}
      >
        <Text
          style={[
            styles.label,
            active === 'Alerts' && styles.labelActive,
          ]}
        >
          Alerts
        </Text>
      </Pressable>

      <Pressable
        style={styles.tab}
        onPress={() => navigation.navigate('GuardProfile')}
      >
        <Text
          style={[
            styles.label,
            active === 'Profile' && styles.labelActive,
          ]}
        >
          Profile
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.dividerBorder,
    backgroundColor: colors.cardBackground,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },

  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  labelActive: {
    color: colors.primary,
  },
});