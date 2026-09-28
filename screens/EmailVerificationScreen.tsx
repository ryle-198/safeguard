import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { ensureResidentRecord } from '../lib/ensureResidentRecord';
import { colors } from '../theme/tokens';
import { RootStackParamList } from '../src/types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerification'>;

export default function EmailVerificationScreen({ navigation, route }: Props) {
  const { email, fullName } = route.params;

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const checkVerification = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session check failed:', sessionError);
        setError(sessionError.message);
        return;
      }

      if (!session?.user) {
        setError(
          'Your email has not been verified yet. Please check your inbox and click the verification link.'
        );
        return;
      }

      /*
       * Email is verified and we have an authenticated session.
       *
       * Create the profile + resident row now, since nothing else in
       * the signup flow does this. ensureResidentRecord is safe to call
       * again if the user taps this button more than once.
       */
      try {
        await ensureResidentRecord(session.user.id, fullName);
      } catch (err: any) {
        setError(`Error setting up your account: ${err.message}`);
        return;
      }

      setMessage('Email verified successfully!');

      setTimeout(() => {
        // NOTE: navigates to SetHomeLocation (step 3 of the onboarding flow),
        // not straight to Home - change this deliberately if you want to
        // skip that step, not by accident.
        navigation.replace('SetHomeLocation');
      }, 800);
    } catch (err) {
      console.error('Verification check failed:', err);
      setError('Something went wrong while checking your verification.');
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    setResending(true);
    setMessage('');
    setError('');

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: 'safeguard://auth/callback',
        },
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setMessage('A new verification email has been sent.');
    } catch (err) {
      console.error('Resend verification failed:', err);
      setError('Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo / App name */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>SAFEGUARD</Text>
        </View>

        {/* Verification icon */}
        {/* <View style={styles.iconCircle}>
          <Text style={styles.icon}>✉</Text>
        </View> */}

        {/* Heading */}
        <Text style={styles.title}>Verify Your Email</Text>

        <Text style={styles.description}>We've sent a verification link to:</Text>

        <Text style={styles.email}>{email}</Text>

        <Text style={styles.instructions}>
          Please check your inbox and click the verification link to activate your SAFEGUARD
          account.
        </Text>

        {/* Status message */}
        {message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Verified button */}
        <Pressable
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={checkVerification}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>I'VE VERIFIED MY EMAIL</Text>
          )}
        </Pressable>

        {/* Resend */}
        <Pressable
          style={styles.secondaryButton}
          onPress={resendVerificationEmail}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>RESEND VERIFICATION EMAIL</Text>
          )}
        </Pressable>

        {/* Back */}
        <Pressable onPress={() => navigation.replace('Login')} style={styles.backButton}>
          <Text style={styles.backText}>Back to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoContainer: {
    marginBottom: 32,
  },

  logoText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
  },

  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  icon: {
    fontSize: 38,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },

  description: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
  },

  email: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 6,
    marginBottom: 18,
    textAlign: 'center',
  },

  instructions: {
    fontSize: 14,
    lineHeight: 21,
    color: '#777777',
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: 24,
  },

  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  disabledButton: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  secondaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  backButton: {
    marginTop: 22,
    padding: 8,
  },

  backText: {
    color: '#666666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  messageBox: {
    width: '100%',
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
    marginBottom: 12,
  },

  messageText: {
    color: '#2E7D32',
    fontSize: 13,
    textAlign: 'center',
  },

  errorBox: {
    width: '100%',
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#FDECEC',
    marginBottom: 12,
  },

  errorText: {
    color: '#C62828',
    fontSize: 13,
    textAlign: 'center',
  },
});