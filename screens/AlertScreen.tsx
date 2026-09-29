import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Alert'>;

// Matches the alert_status enum in the Postgres schema exactly - keep in
// sync with the same type in HomeScreen.tsx if wording/states change.
type AlertStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';

interface AlertHistoryItem {
  id: string;
  title: string;
  details: string;
  time: string;
  status: AlertStatus;
}

// Shape returned by the Supabase query below, before mapping into
// AlertHistoryItem for rendering.
interface AlertRow {
  id: number | string;
  status: AlertStatus;
  incident_type: string | null;
  guard_notes: string | null;
  triggered_at: string;
  resolved_at: string | null;
  cancelled_at: string | null;
  guard: {
    patrol_zone_id: number | null;
    profile: { full_name: string } | null;
  } | null;
}

function statusColor(status: AlertStatus) {
  switch (status) {
    case 'RESOLVED':
      return colors.statusOnline;
    case 'CANCELLED':
      return colors.textSecondary;
    case 'PENDING':
    case 'ACCEPTED':
    case 'EN_ROUTE':
    case 'ARRIVED':
    default:
      return colors.primary;
  }
}

function alertTitle(row: AlertRow): string {
  return row.incident_type?.trim() ? row.incident_type : 'Emergency SOS';
}

function alertDetails(row: AlertRow): string {
  const guardName = row.guard?.profile?.full_name;

  if (guardName) {
    return `Guard: ${guardName}`;
  }

  if (row.status === 'CANCELLED') {
    return 'Cancelled before a guard was assigned';
  }

  return 'Awaiting guard assignment';
}

function formatAlertTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) {
    return `Today, ${timePart}`;
  }

  if (isYesterday) {
    return `Yesterday, ${timePart}`;
  }

  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return `${datePart}, ${timePart}`;
}

function mapRowToItem(row: AlertRow): AlertHistoryItem {
  return {
    id: String(row.id),
    title: alertTitle(row),
    details: alertDetails(row),
    time: formatAlertTime(row.triggered_at),
    status: row.status,
  };
}

export default function AlertScreen({ navigation }: Props) {
  const [alerts, setAlerts] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        // Embeds the assigned guard (via alerts.guard_id -> guards.user_id)
        // and that guard's profile (via guards.user_id -> profiles.id) so we
        // can show a name without a second round trip. Requires RLS
        // policies granting residents SELECT on their own alerts, plus
        // SELECT on guards/profiles rows referenced by their own alerts -
        // see notes below the code.
        const { data, error } = await supabase
          .from('alerts')
          .select(
            `
            id,
            status,
            incident_type,
            guard_notes,
            triggered_at,
            resolved_at,
            cancelled_at,
            guard:guards (
              patrol_zone_id,
              profile:profiles ( full_name )
            )
          `
          )
          .eq('resident_id', user.id)
          .order('triggered_at', { ascending: false });

        if (error) {
          console.error('Failed to load alerts:', error.message);
          setLoadError('Unable to load your alert history.');
          return;
        }

        const rows = (data ?? []) as unknown as AlertRow[];
        setAlerts(rows.map(mapRowToItem));
      } catch (error) {
        console.error('Unexpected error loading alerts:', error);
        setLoadError('Unable to load your alert history.');
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  const stats = useMemo(() => {
    const total = alerts.length;
    const resolved = alerts.filter((a) => a.status === 'RESOLVED').length;
    const cancelled = alerts.filter((a) => a.status === 'CANCELLED').length;
    const pending = alerts.filter(
      (a) => a.status === 'PENDING' || a.status === 'ACCEPTED' || a.status === 'EN_ROUTE' || a.status === 'ARRIVED'
    ).length;

    // "Emergency" = every trigger that wasn't cancelled before a guard
    // engaged - i.e. total minus cancelled/false alarms.
    const emergency = total - cancelled;

    return { total, emergency, resolved, pending };
  }, [alerts]);

  return (
    <View style={styles.root}>
      <HeaderBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headline}>
          <Text style={styles.title}>Alert History</Text>
          <Text style={styles.subtitle}>Review all emergency triggers and outcomes.</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          <View style={styles.row}>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Total Alerts</Text>
              <Text style={styles.boxValue}>{stats.total}</Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Emergency Alerts</Text>
              <Text style={styles.boxValue}>{stats.emergency}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Resolved</Text>
              <Text style={[styles.boxValue, { color: colors.statusOnline }]}>
                {stats.resolved}
              </Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Pending</Text>
              <Text style={[styles.boxValue, { color: colors.primary }]}>
                {stats.pending}
              </Text>
            </View>
          </View>
        </View>

        {/* Alert History List */}
        <View style={styles.alertHistory}>
          <Text style={styles.alertHistoryTitle}>Recent Alerts</Text>

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{loadError}</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No alerts triggered yet.</Text>
            </View>
          ) : (
            alerts.map((alert) => (
              <Pressable
                key={alert.id}
                style={styles.alertItem}
                onPress={() => navigation.navigate('AlertDetail', { alertId: alert.id })}
              >
                <View style={styles.alertItemLeft}>
                  <View
                    style={[styles.statusDot, { backgroundColor: statusColor(alert.status) }]}
                  />
                  <View>
                    <Text style={styles.alertItemTitle}>{alert.title}</Text>
                    <Text style={styles.alertItemDetails}>{alert.details}</Text>
                  </View>
                </View>
                <Text style={styles.alertTime}>{alert.time}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNavBar active="Alerts" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  headline: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.7,
    color: colors.headingDark,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  grid: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  box: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    minHeight: 100,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  boxTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  boxValue: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  alertHistory: {
    width: '100%',
    marginTop: spacing.xl,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  alertHistoryTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  emptyState: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  alertItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.sm,
  },
  alertItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  alertItemTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  alertItemDetails: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alertTime: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.textSecondary,
  },
});