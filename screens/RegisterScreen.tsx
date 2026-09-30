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
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Register'
>;

const ASSETS = {
  emailIcon: require('../assets/userIcon.png'),
  arrowIcon: require('../assets/arrowIcon.png'),
  shieldBadgeIcon: require('../assets/lockBadgeIcon.png'),
  headerShieldIcon: require('../assets/shield.png'),
};

const emailRedirectTo = 
Platform.OS === 'web'
  ? 'https://safeguard-kanon9.vercel.app'
    : 'safeguard://auth/callback';

export default function RegisterScreen({
  navigation,
}: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateAccount = async () => {
    setError('');

    // Basic validation
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    if (password.length < 6) {
      setError(
        'Password must be at least 6 characters.'
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error: signUpError,
      } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        console.error(
          'Sign up failed:',
          signUpError.message
        );

        setError(
          getSignupErrorMessage(signUpError.message)
        );

        return;
      }

      console.log(
        'Account created:',
        data.user?.id
      );

      /*
       * With email confirmation enabled, Supabase
       * sends a confirmation email to the user.
       *
       * We do NOT navigate to VerifyOtp because
       * VerifyOtp is currently designed for SMS OTP.
       */

      navigation.navigate('EmailVerification', {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
      });
    } catch (err) {
      console.error(
        'Unexpected signup error:',
        err
      );

      setError(
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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

          <Text style={styles.stepIndicator}>
            Step 1 of 3
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Header */}
          <View style={styles.welcomeHeader}>
            <Text style={styles.title}>
              Resident Enrollment
            </Text>

            <Text style={styles.subtitle}>
              Secure access to your residential safety
              network. Identity verification required.
            </Text>
          </View>

          {/* Registration Card */}
          <View style={styles.card}>
            {/* FULL NAME */}
            <Text style={styles.inputLabel}>
              FULL NAME
            </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={
                  colors.inputPlaceholder
                }
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* EMAIL */}
            <Text style={styles.inputLabel}>
              EMAIL ADDRESS
            </Text>

            <View style={styles.inputWrapper}>
              <Image
                source={ASSETS.emailIcon}
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                placeholder="e.g. user@example.com"
                placeholderTextColor={
                  colors.inputPlaceholder
                }
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* PASSWORD */}
            <Text style={styles.inputLabel}>
              PASSWORD
            </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor={
                  colors.inputPlaceholder
                }
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* ERROR */}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* CREATE ACCOUNT */}
            <Pressable
              style={[
                styles.requestButton,
                loading &&
                  styles.requestButtonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={loading}
            >
              <Text
                style={
                  styles.requestButtonLabel
                }
              >
                {loading
                  ? 'CREATING ACCOUNT...'
                  : 'CREATE ACCOUNT'}
              </Text>

              {!loading && (
                <Image
                  source={ASSETS.arrowIcon}
                  style={styles.arrowIcon}
                />
              )}
            </Pressable>

            <Text style={styles.disclaimer}>
              A verification link will be sent to
              your email address.
            </Text>
          </View>

          {/* Security Badge */}
          <View style={styles.badge}>
            <Image
              source={ASSETS.shieldBadgeIcon}
              style={styles.badgeIcon}
            />

            <Text style={styles.badgeText}>
              S-GRADE SECURITY CLEARANCE
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function getSignupErrorMessage(
  message: string
): string {
  const lowerMessage =
    message.toLowerCase();

  if (
    lowerMessage.includes(
      'user already registered'
    )
  ) {
    return 'An account with this email already exists.';
  }

  if (
    lowerMessage.includes(
      'password should be at least'
    )
  ) {
    return 'Password must be at least 6 characters.';
  }

  if (
    lowerMessage.includes('invalid email')
  ) {
    return 'Please enter a valid email address.';
  }

  return message;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor:
      colors.enrollmentHeaderBorder,
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
    fontFamily:
      typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.48,
    color: colors.textPrimary,
  },

  subtitle: {
    fontFamily:
      typography.fontFamily.regular,
    fontWeight: '400',
    fontSize:
      typography.body.fontSize,
    lineHeight:
      typography.body.lineHeight,
    color: colors.textSecondary,
  },

  card: {
    width: '100%',
    maxWidth: 400,
    marginTop: spacing.xl,
    backgroundColor:
      colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md * 2,
    padding: spacing.xl,
    gap: spacing.md,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },

  inputLabel: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize:
      typography.label.fontSize,
    lineHeight:
      typography.label.lineHeight,
    letterSpacing:
      typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  inputWrapper: {
    backgroundColor:
      colors.inputBackground,
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
    height: 18,
    resizeMode: 'contain',
    marginRight: spacing.md,
  },

  input: {
    flex: 1,
    fontFamily:
      typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: 18,
    color: colors.textPrimary,
  },

  errorContainer: {
    width: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  errorText: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#B42318',
    textAlign: 'center',
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },

  requestButtonDisabled: {
    opacity: 0.6,
  },

  requestButtonLabel: {
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize:
      typography.button.fontSize,
    lineHeight:
      typography.button.lineHeight,
    letterSpacing:
      typography.button.letterSpacing,
    color: colors.textOnPrimary,
  },

  arrowIcon: {
    width: 13,
    height: 13,
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
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor:
      colors.badgeBackground,
    borderWidth: 1,
    borderColor:
      colors.dividerBorder,
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
    fontFamily:
      typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize:
      typography.label.fontSize,
    lineHeight:
      typography.label.lineHeight,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
});