import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Community'>;

type AlertStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';

interface NearbyAlert {
  id: string;
  incidentType: string | null;
  status: AlertStatus;
  triggeredAt: string;
  distanceMetres: number;
}

interface Broadcast {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m away`;
  return `${(metres / 1000).toFixed(1)}km away`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusColor(status: AlertStatus) {
  return status === 'RESOLVED' ? colors.statusOnline : colors.primary;
}

export default function CommunityScreen({ navigation }: Props) {
  const [alerts, setAlerts] = useState<NearbyAlert[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

  const loadNearbyAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    setFeedError(null);

    try {
      const { data, error } = await supabase.rpc('nearby_alerts', { radius_metres: 2000 });

      if (error) {
        console.error('Failed to load nearby alerts:', error.message);
        setFeedError(
          error.message.includes('home_location')
            ? 'Set your home location to see nearby activity.'
            : 'Unable to load nearby activity.'
        );
        return;
      }

      const mapped: NearbyAlert[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        incidentType: row.incident_type,
        status: row.status,
        triggeredAt: row.triggered_at,
        distanceMetres: row.distance_metres,
      }));

      setAlerts(mapped);
    } catch (err) {
      console.error('Unexpected error loading nearby alerts:', err);
      setFeedError('Unable to load nearby activity.');
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  const loadBroadcasts = useCallback(async () => {
    setLoadingBroadcasts(true);

    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('id, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load broadcasts:', error.message);
        return;
      }

      const mapped: Broadcast[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        title: row.title,
        message: row.message,
        createdAt: row.created_at,
      }));

      setBroadcasts(mapped);
    } catch (err) {
      console.error('Unexpected error loading broadcasts:', err);
    } finally {
      setLoadingBroadcasts(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNearbyAlerts();
      loadBroadcasts();
    }, [loadNearbyAlerts, loadBroadcasts])
  );

  return (
    <View style={styles.root}>
      <HeaderBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headline}>
          <Text style={styles.title}>Community</Text>
          <Text style={styles.subtitle}>Safety broadcasts and nearby activity in your area.</Text>
        </View>
        <Pressable
  style={styles.hotspotButton}
  onPress={() => navigation.navigate('HotspotMap')}
>
  <Text style={styles.hotspotButtonLabel}>VIEW CRIME HOTSPOT MAP</Text>
</Pressable>

        {/* Safety Broadcasts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SAFETY BROADCASTS</Text>

          {loadingBroadcasts ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : broadcasts.length === 0 ? (
            <Text style={styles.emptyText}>No safety broadcasts right now.</Text>
          ) : (
            broadcasts.map((broadcast) => (
              <View key={broadcast.id} style={styles.broadcastCard}>
                <Text style={styles.broadcastTitle}>{broadcast.title}</Text>
                <Text style={styles.broadcastMessage}>{broadcast.message}</Text>
                <Text style={styles.broadcastTime}>{formatTime(broadcast.createdAt)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Nearby Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NEARBY ACTIVITY (2KM)</Text>

          {loadingAlerts ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : feedError ? (
            <Text style={styles.emptyText}>{feedError}</Text>
          ) : alerts.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity reported nearby.</Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(alert.status) }]} />
                <View style={styles.alertTextGroup}>
                  <Text style={styles.alertTitle}>
                    {alert.incidentType?.trim() || 'Emergency SOS'}
                  </Text>
                  <Text style={styles.alertMeta}>
                    {formatDistance(alert.distanceMetres)} • {formatTime(alert.triggeredAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <BottomNavBar active="Maps" />
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
    gap: spacing.xl,
  },
  headline: {
    gap: spacing.xs,
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
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  loadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  broadcastCard: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  broadcastTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  broadcastMessage: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  broadcastTime: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  alertTextGroup: {
    flex: 1,
  },
  alertTitle: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  alertMeta: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
hotspotButton: {
  height: 48,
  borderRadius: radii.sm,
  backgroundColor: colors.primary,
  alignItems: 'center',
  justifyContent: 'center',
},
hotspotButtonLabel: {
  fontFamily: typography.fontFamily.bold,
  fontWeight: '700',
  fontSize: 13,
  letterSpacing: 1.2,
  color: '#FFFFFF',
  textTransform: 'uppercase',
},
});