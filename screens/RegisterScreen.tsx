import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { __String } from 'typescript';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// TODO: temporary Figma-hosted URLs, expire ~7 days after export - see
// screens/LoginScreen.js for the export-and-replace steps.
const ASSETS = {
  phoneIcon: require('../assets/phoneIcon.png'),
  arrowIcon: require('../assets/arrowIcon.png'),
  shieldBadgeIcon: require('../assets/lockBadgeIcon.png'),
  headerShieldIcon: require('../assets/shield.png'),
};

export default function RegisterScreen({ navigation }: Props) {
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const handleRequestAccessCode = () => {
    // TODO: wire up to POST /api/auth/register
    navigation.navigate('VerifyOtp', { phoneNumber });
  };

  return (
    <View style={styles.root}>
      {/* Header - Top AppBar */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <Image source={ASSETS.headerShieldIcon} style={styles.headerIcon} />
            <Text style={styles.wordmark}>SAFEGUARD</Text>
          </View>
          <Text style={styles.stepIndicator}>Step 1 of 3</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Header */}
          <View style={styles.welcomeHeader}>
            <Text style={styles.title}>Resident Enrollment</Text>
            <Text style={styles.subtitle}>
              Secure access to your residential safety network. Identity verification required.
            </Text>
          </View>

          {/* Stage 1: Phone Input Card */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>PHONE NUMBER</Text>
            <View style={styles.inputWrapper}>
              <Image source={ASSETS.phoneIcon} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+27 00 000 000"
                placeholderTextColor={colors.inputPlaceholder}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>

            <Pressable style={styles.requestButton} onPress={handleRequestAccessCode}>
              <Text style={styles.requestButtonLabel}>REQUEST ACCESS CODE</Text>
              <Image source={ASSETS.arrowIcon} style={styles.arrowIcon} />
            </Pressable>

            <Text style={styles.disclaimer}>
              Standard messaging rates apply. Secure 256-bit encrypted verification.
            </Text>
          </View>

          {/* Security Badge */}
          <View style={styles.badge}>
            <Image source={ASSETS.shieldBadgeIcon} style={styles.badgeIcon} />
            <Text style={styles.badgeText}>S-GRADE SECURITY CLEARANCE</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.enrollmentHeaderBorder,
  },
  headerRow: {
    height: 68,
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
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.36,
    color: colors.stepLabel,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  welcomeHeader: {
    width: '100%',
    maxWidth: 400,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    marginTop: spacing.xl,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md * 2,
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  inputLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: 62,
  },
  inputIcon: {
    width: 18,
    height: 24,
    resizeMode: 'contain',
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: 18,
    color: colors.textPrimary,
  },
  requestButton: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  requestButtonLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    color: colors.textOnPrimary,
  },
  arrowIcon: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
  },
  disclaimer: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.badgeBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xxl,
  },
  badgeIcon: {
    width: 11,
    height: 13,
    resizeMode: 'contain',
  },
  badgeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
});