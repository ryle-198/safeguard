import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';

const PRICE_LABEL = 'R99'; // display only; the real price lives in the edge function

type Membership = {
  membership_active: boolean;
  membership_expires_at: string | null;
};

export default function MembershipCard() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // expires_at is the source of truth, not just the boolean flag
  const isActive =
    !!membership?.membership_active &&
    !!membership.membership_expires_at &&
    new Date(membership.membership_expires_at).getTime() > Date.now();

  const load = useCallback(async (): Promise<boolean> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('residents')
      .select('membership_active, membership_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    setMembership(data ?? { membership_active: false, membership_expires_at: null });
    return (
      !!data?.membership_active &&
      !!data.membership_expires_at &&
      new Date(data.membership_expires_at).getTime() > Date.now()
    );
  }, []);

  // After returning from PayFast the ITN can lag a few seconds, so poll briefly.
  const pollForActivation = useCallback(
    (attempt = 0) => {
      setChecking(true);
      load().then((active) => {
        if (active || attempt >= 6) {
          setChecking(false);
          return;
        }
        pollTimer.current = setTimeout(() => pollForActivation(attempt + 1), 3000);
      });
    },
    [load],
  );

  useEffect(() => {
    load();
    // Web: PayFast sends the browser back to /?payment=success
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.location.search.includes('payment=success')
    ) {
      pollForActivation();
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [load, pollForActivation]);

const handlePay = async () => {
  setPaying(true);
  setError('');
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'create-payfast-payment',
      { body: { native: Platform.OS !== 'web' } },
    );
    if (fnError || !data?.url) throw fnError ?? new Error('No payment URL returned.');

      if (Platform.OS === 'web') {
        window.location.href = data.url; // leaves the app; returns via return_url
      } else {
        await WebBrowser.openBrowserAsync(data.url); // resolves when the user closes it
        pollForActivation();
      }
    } catch (e: any) {
      console.error('Payment start failed:', e);
      setError(e?.message || 'Could not start payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const expiryText = membership?.membership_expires_at
    ? new Date(membership.membership_expires_at).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>MEMBERSHIP</Text>

      {isActive ? (
        <Text style={styles.statusActive}>Active until {expiryText}</Text>
      ) : (
        <Text style={styles.statusInactive}>
          {membership?.membership_expires_at
            ? `Expired on ${expiryText}`
            : 'No active membership'}
        </Text>
      )}

      {checking ? (
        <View style={styles.checkingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.helper}>Confirming your payment…</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, paying && styles.buttonDisabled]}
        onPress={handlePay}
        disabled={paying}
      >
        {paying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isActive
              ? `RENEW EARLY · ${PRICE_LABEL}/MONTH`
              : `ACTIVATE MEMBERSHIP · ${PRICE_LABEL}/MONTH`}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => pollForActivation()}>
        <Text style={styles.refresh}>Already paid? Refresh status</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: 17,
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSecondary,
  },
  statusActive: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 15,
    color: '#15803D',
  },
  statusInactive: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 15,
    color: colors.profileHeading,
  },
  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  helper: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: '#B42318',
  },
  button: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  refresh: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
    paddingTop: spacing.xs,
  },
});