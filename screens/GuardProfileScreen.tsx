import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import GuardBottomNavBar from '../components/GuardBottomNavBar';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'GuardProfile'>;

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type GuardAvailability = 'OFF_DUTY' | 'AVAILABLE' | 'ON_BREAK';

interface GuardRow {
  verification_status: VerificationStatus;
  availability: GuardAvailability;
  shift_started_at: string | null;
  patrol_zone_id: number | null;
}

interface Stats {
  handled: number;
  active: number;
  avgResponseMinutes: number | null;
}

const ACTIVE_STATUSES = ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'G';
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function dutyLabel(availability: GuardAvailability | undefined): string {
  if (availability === 'AVAILABLE') return 'AVAILABLE';
  if (availability === 'ON_BREAK') return 'ON BREAK';
  return 'OFF DUTY';
}

function verificationLabel(status: VerificationStatus | undefined): string {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Not approved';
  return 'Pending';
}

export default function GuardProfileScreen(_props: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [guard, setGuard] = useState<GuardRow | null>(null);
  const [stats, setStats] = useState<Stats>({
    handled: 0,
    active: 0,
    avgResponseMinutes: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
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

      setEmail(user.email ?? '');

      const [profileRes, guardRes, alertsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),

        supabase
          .from('guards')
          .select('verification_status, availability, shift_started_at, patrol_zone_id')
          .eq('user_id', user.id)
          .single(),

        supabase
          .from('alerts')
          .select('status, triggered_at, accepted_at')
          .eq('guard_id', user.id),
      ]);

      if (profileRes.error) {
        throw profileRes.error;
      }

      if (guardRes.error) {
        throw guardRes.error;
      }

      if (alertsRes.error) {
        throw alertsRes.error;
      }

      setFullName(profileRes.data?.full_name ?? '');
      setGuard(guardRes.data as GuardRow);

      const rows = alertsRes.data ?? [];

      const handled = rows.filter((a: any) => a.status === 'RESOLVED').length;
      const active = rows.filter((a: any) => ACTIVE_STATUSES.includes(a.status)).length;

      const responseTimes = rows
        .filter((a: any) => a.accepted_at && a.triggered_at)
        .map(
          (a: any) =>
            (new Date(a.accepted_at).getTime() - new Date(a.triggered_at).getTime()) / 60000
        )
        .filter((minutes: number) => Number.isFinite(minutes) && minutes >= 0);

      const avgResponseMinutes =
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((sum: number, m: number) => sum + m, 0) /
                responseTimes.length
            )
          : null;

      setStats({ handled, active, avgResponseMinutes });
    } catch (err: any) {
      console.error('Failed to load guard profile:', err);
      setError(err?.message || 'Failed to load guard profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const formatShiftStart = (dateString: string | null) => {
    if (!dateString) {
      return null;
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOnShift = guard?.availability === 'AVAILABLE' || guard?.availability === 'ON_BREAK';
  const shiftStart = isOnShift ? formatShiftStart(guard?.shift_started_at ?? null) : null;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>

              <Pressable onPress={loadProfile} style={styles.retryButton}>
                <Text style={styles.retryText}>TRY AGAIN</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
            </View>

            <Text style={styles.name}>{fullName || 'Guard'}</Text>
            <Text style={styles.roleLabel}>SECURITY GUARD</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.handled}</Text>
              <Text style={styles.statLabel}>Alerts handled</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.active}</Text>
              <Text style={styles.statLabel}>Active now</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {stats.avgResponseMinutes === null ? '-' : `${stats.avgResponseMinutes} min`}
              </Text>
              <Text style={styles.statLabel}>Avg response</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>DETAILS</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{email || '-'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duty status</Text>
              <Text style={styles.detailValue}>{dutyLabel(guard?.availability)}</Text>
            </View>

            {shiftStart ? (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shift started</Text>
                  <Text style={styles.detailValue}>{shiftStart}</Text>
                </View>
              </>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Patrol zone</Text>
              <Text style={styles.detailValue}>
                {guard?.patrol_zone_id != null ? `Zone ${guard.patrol_zone_id}` : 'Not assigned'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verification</Text>
              <Text style={styles.detailValue}>
                {verificationLabel(guard?.verification_status)}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      <GuardBottomNavBar active="Profile" />
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
    borderBottomColor: colors.border,
  },

  headerRow: {
    height: 64,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },

  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 20,
    color: colors.textPrimary,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 32,
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
    backgroundColor: colors.primary,
  },

  retryText: {
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
  },

  hero: {
    alignItems: 'center',
    gap: spacing.xs,
  },

  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  avatarText: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 30,
    color: colors.primary,
  },

  name: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 24,
    color: colors.headingDark,
  },

  roleLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  statBox: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },

  statValue: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 20,
    color: colors.textPrimary,
  },

  statLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  card: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  cardLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  detailLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },

  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.dividerBorder,
  },
});