import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import GuardBottomNavBar from '../components/GuardBottomNavBar';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'GuardAlerts'>;

type AlertStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'RESOLVED'
  | 'CANCELLED';

interface GuardAlertRow {
  id: string;
  status: AlertStatus;
  triggeredAt: string;
}

function statusTitle(status: AlertStatus): string {
  switch (status) {
    case 'PENDING':
      return 'New Emergency Alert';
    case 'ACCEPTED':
      return 'Alert Accepted';
    case 'EN_ROUTE':
      return 'En Route';
    case 'ARRIVED':
      return 'On Scene';
    case 'RESOLVED':
      return 'Resolved';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Emergency Alert';
  }
}

export default function GuardAlertsScreen({ navigation }: Props) {
  const [alerts, setAlerts] = useState<GuardAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('alerts')
        .select('id, status, triggered_at')
        .eq('guard_id', user.id)
        .order('triggered_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Failed to load alerts:', error.message);
        return;
      }

      const rows: GuardAlertRow[] = (data ?? []).map((alert: any) => ({
        id: String(alert.id),
        status: (alert.status ?? 'PENDING') as AlertStatus,
        triggeredAt: alert.triggered_at ?? new Date().toISOString(),
      }));

      setAlerts(rows);
    } catch (error) {
      console.error('Unexpected error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAlerts);
    return unsubscribe;
  }, [navigation, loadAlerts]);

  /**
   * Quick-accept straight from the list, without opening the detail
   * screen first. Sets status -> ACCEPTED and stamps accepted_at.
   */
  const handleQuickAccept = async (alertId: string) => {
    setRespondingId(alertId);

    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) {
        console.error('Failed to accept alert:', error.message);
        Alert.alert('Could not accept alert', 'Please try again.');
        return;
      }

      await loadAlerts();
      navigation.navigate('GuardActiveAlert', { alertId });
    } finally {
      setRespondingId(null);
    }
  };

  const formatAlertTime = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Alerts</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No alerts assigned to you yet.</Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <Pressable
                style={styles.alertCardMain}
                onPress={() =>
                  navigation.navigate('GuardActiveAlert', { alertId: alert.id })
                }
              >
                <Text style={styles.alertTitle}>{statusTitle(alert.status)}</Text>
                <Text style={styles.alertMeta}>
                  {alert.status} • {formatAlertTime(alert.triggeredAt)}
                </Text>
              </Pressable>

              {alert.status === 'PENDING' ? (
                <Pressable
                  style={[
                    styles.acceptButton,
                    respondingId === alert.id && styles.buttonDisabled,
                  ]}
                  onPress={() => handleQuickAccept(alert.id)}
                  disabled={respondingId === alert.id}
                >
                  <Text style={styles.acceptButtonLabel}>
                    {respondingId === alert.id ? '...' : 'ACCEPT'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() =>
                    navigation.navigate('GuardActiveAlert', { alertId: alert.id })
                  }
                >
                  <Text style={styles.viewLink}>VIEW →</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <GuardBottomNavBar active="Alerts" />
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

  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 32,
  },

  loadingCard: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
  },

  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },

  alertCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  alertCardMain: {
    flex: 1,
    gap: 2,
  },

  alertTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },

  alertMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.textSecondary,
  },

  acceptButton: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  acceptButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    color: '#FFFFFF',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  viewLink: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.primary,
  },
});