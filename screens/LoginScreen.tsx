import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import FormInput from '../components/FormInput';
import Button from '../components/Button';
import HeaderBar from '../components/HeaderBar';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';

const ASSETS = {
  shieldIcon: require('../assets/lock.png'),
  userIcon: require('../assets/userIcon.png'),
  lockIcon: require('../assets/passwordLock.png'),
  eyeIcon: require('../assets/eyeIcon.png'),
  loginIcon: require('../assets/loginIcon.png'),
  lockBadgeIcon: require('../assets/lockBadgeIcon.png'),
  headerShieldIcon: require('../assets/shield.png'),
};

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async (): Promise<void> => {
    if (loading) {
      return;
    }

    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      Alert.alert(
        'Missing information',
        'Please enter your phone number or email and your password.'
      );
      return;
    }

    setLoading(true);

    try {
      let error;

      /*
       * Supabase has separate login methods for email and phone.
       * If the user entered an email, use email authentication.
       * Otherwise, treat the value as a phone number.
       */
      if (trimmedIdentifier.includes('@')) {
        const result = await supabase.auth.signInWithPassword({
          email: trimmedIdentifier,
          password,
        });

        error = result.error;
      } else {
        const result = await supabase.auth.signInWithPassword({
          phone: trimmedIdentifier,
          password,
        });

        error = result.error;
      }

      if (error) {
        console.error('Login failed:', error.message);

        Alert.alert('Login failed', getLoginErrorMessage(error.message));

        return;
      }

      /*
       * Do NOT navigate manually here.
       *
       * App.tsx listens to Supabase's onAuthStateChange via useAuthRole,
       * resolves the session to a role, and swaps the entire navigator
       * stack automatically (auth screens -> GuardHome or Home). Calling
       * navigation.replace('Home') here is redundant, and it actively
       * breaks guard logins and fires "screen not handled by any
       * navigator" warnings, because at the exact moment this resolves,
       * LoginScreen is still mounted inside the auth-only stack, where
       * neither 'Home' nor 'GuardHome' exist yet.
       */
    } catch (error) {
      console.error('Unexpected login error:', error);

      Alert.alert('Login failed', 'Something went wrong while signing in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <HeaderBar />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.main}>
            {/* Hero Branding Section */}
            <View style={styles.hero}>
              <View style={styles.heroIconBadge}>
                <Image source={ASSETS.shieldIcon} style={styles.heroIcon} />
              </View>

              <Text style={styles.heading}>Secure Access</Text>

              <Text style={styles.subheading}>
                Enter your credentials to manage your security protocols.
              </Text>
            </View>

            {/* Main Login Card */}
            <View style={styles.card}>
              <View style={styles.form}>
                <FormInput
                  label="Phone Number or Email"
                  placeholder="e.g. user@safeguard.pro"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={identifier.includes('@') ? 'email-address' : 'default'}
                  editable={!loading}
                  icon={<Image source={ASSETS.userIcon} style={styles.inputIcon} />}
                />

                <FormInput
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  icon={<Image source={ASSETS.lockIcon} style={styles.inputIconTall} />}
                  labelAccessory={
                    <TouchableOpacity
                      disabled={loading}
                      onPress={() =>
                        Alert.alert(
                          'Forgot Password',
                          'Password reset can be added here using Supabase password recovery.'
                        )
                      }
                    >
                      <Text style={styles.forgotLink}>Forgot Password?</Text>
                    </TouchableOpacity>
                  }
                  rightAccessory={
                    <TouchableOpacity
                      disabled={loading}
                      onPress={() => setPasswordVisible((value) => !value)}
                    >
                      <Image source={ASSETS.eyeIcon} style={styles.eyeIcon} />
                    </TouchableOpacity>
                  }
                />

                <Button
                  label={loading ? 'LOGGING IN...' : 'LOGIN'}
                  onPress={handleLogin}
                  icon={
                    loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Image source={ASSETS.loginIcon} style={styles.buttonIcon} />
                    )
                  }
                />
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />

                <Text style={styles.dividerText}>OR</Text>

                <View style={styles.dividerLine} />
              </View>

              <Button
                label="REGISTER NEW ACCOUNT"
                variant="secondary"
                onPress={() => navigation.navigate('Register')}
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.badge}>
                <Image source={ASSETS.lockBadgeIcon} style={styles.badgeIcon} />

                <Text style={styles.badgeText}>END-TO-END ENCRYPTED</Text>
              </View>

              <Text style={styles.footerText}>
                SAFEGUARD Protocol  •
                Institutional Security Standards
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Converts Supabase's technical authentication
 * messages into messages that make sense to the user.
 */
function getLoginErrorMessage(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('invalid login credentials')) {
    return 'The phone number/email or password is incorrect.';
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'Please verify your account before logging in.';
  }

  if (lowerMessage.includes('phone not confirmed')) {
    return 'Please verify your phone number before logging in.';
  }

  if (lowerMessage.includes('too many requests')) {
    return 'Too many login attempts. Please wait a moment and try again.';
  }

  return message;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardContainer: {
    flex: 1,
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 40,
    paddingBottom: 40,
  },

  main: {
    width: '100%',
    maxWidth: 480,
    gap: spacing.xl,
  },

  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },

  heroIconBadge: {
    width: 64,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroIcon: {
    width: 21,
    height: 28,
    resizeMode: 'contain',
  },

  heading: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: typography.heading1.fontSize,
    lineHeight: typography.heading1.lineHeight,
    letterSpacing: typography.heading1.letterSpacing,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingTop: spacing.md,
  },

  subheading: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  card: {
    width: '100%',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 25,
    gap: spacing.xl,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },

  form: {
    width: '100%',
    gap: spacing.lg,
  },

  inputIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },

  inputIconTall: {
    width: 16,
    height: 21,
    resizeMode: 'contain',
  },

  forgotLink: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.primary,
  },

  eyeIcon: {
    width: 22,
    height: 15,
    resizeMode: 'contain',
  },

  buttonIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.dividerBorder,
  },

  dividerText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
  },

  footer: {
    alignItems: 'center',
    gap: spacing.sm,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.badgeBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 5,
  },

  badgeIcon: {
    width: 9,
    height: 12,
    resizeMode: 'contain',
  },

  badgeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '700',
    fontSize: typography.badge.fontSize,
    lineHeight: typography.badge.lineHeight,
    letterSpacing: typography.badge.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  footerText: {
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});