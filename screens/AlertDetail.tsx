import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import HeaderBar from '../components/HeaderBar';
import BottomNavBar from '../components/BottomNavBar';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'AlertDetail'>;

type AlertStatus = 'PENDING' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED' | 'CANCELLED';

interface AlertDetailData {
  id: string;
  status: AlertStatus;
  incidentType: string | null;
  guardNotes: string | null;
  locationText: string | null;
  residentRating: number | null;
  guardName: string | null;
  triggeredAt: string;
  acceptedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  guardPsiraNumber: string | null;
  guardPhotoUrl: string | null;
}

interface TimelineStep {
  label: string;
  timestamp: string | null;
  reached: boolean;
}

function buildTimeline(alert: AlertDetailData): TimelineStep[] {
  if (alert.status === 'CANCELLED') {
    return [
      { label: 'Alert Triggered', timestamp: alert.triggeredAt, reached: true },
      { label: 'Cancelled', timestamp: alert.cancelledAt, reached: true },
    ];
  }

  return [
    { label: 'Alert Triggered', timestamp: alert.triggeredAt, reached: true },
    { label: 'Guard Accepted', timestamp: alert.acceptedAt, reached: !!alert.acceptedAt },
    { label: 'Guard En Route', timestamp: alert.enRouteAt, reached: !!alert.enRouteAt },
    { label: 'Guard Arrived', timestamp: alert.arrivedAt, reached: !!alert.arrivedAt },
    { label: 'Resolved', timestamp: alert.resolvedAt, reached: !!alert.resolvedAt },
  ];
}

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AlertDetail({ route }: Props) {
  const { alertId } = route.params;

  const [alert, setAlert] = useState<AlertDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const loadAlert = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(
          `
          id,
          status,
          incident_type,
          guard_notes,
          alerts_location_text,
          resident_rating,
          triggered_at,
          accepted_at,
          en_route_at,
          arrived_at,
          resolved_at,
          cancelled_at,
          guard:guards (
            psira_number,
            photo_url,
            profile:profiles ( full_name )
          )
        `
        )
        .eq('id', alertId)
        .single();

      if (error) {
        console.error('Failed to load alert detail:', error.message);
        return;
      }

      const row = data as any;

      setAlert({
        id: String(row.id),
        status: row.status,
        incidentType: row.incident_type,
        guardNotes: row.guard_notes,
        locationText: row.alerts_location_text,
        residentRating: row.resident_rating,
        guardName: row.guard?.profile?.full_name ?? null,
        triggeredAt: row.triggered_at,
        acceptedAt: row.accepted_at,
        enRouteAt: row.en_route_at,
        arrivedAt: row.arrived_at,
        resolvedAt: row.resolved_at,
        cancelledAt: row.cancelled_at,
        guardPsiraNumber: row.guard?.psira_number ?? null,
        guardPhotoUrl: row.guard?.photo_url ?? null,
      });
    } catch (err) {
      console.error('Unexpected error loading alert detail:', err);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useFocusEffect(
    useCallback(() => {
      loadAlert();
    }, [loadAlert])
  );

  const handleSubmitRating = async () => {
    if (!selectedRating || !alert) return;

    setSubmittingRating(true);

    try {
      const { error } = await supabase
        .from('alerts')
        .update({ resident_rating: selectedRating })
        .eq('id', alert.id);

      if (error) {
        console.error('Failed to submit rating:', error.message);
        Alert.alert('Unable to submit rating', error.message);
        return;
      }

      await loadAlert();
    } catch (err) {
      console.error('Unexpected error submitting rating:', err);
      Alert.alert('Something went wrong', 'Your rating could not be submitted.');
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading || !alert) {
    return (
      <View style={styles.root}>
        <HeaderBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <BottomNavBar active="Alerts" />
      </View>
    );
  }

  const timeline = buildTimeline(alert);
  const canRate = alert.status === 'RESOLVED' && alert.residentRating === null;
  const displayRating = alert.residentRating ?? selectedRating;

  return (
    <View style={styles.root}>
      <HeaderBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headline}>
          <Text style={styles.title}>{alert.incidentType?.trim() || 'Emergency SOS'}</Text>
          <Text style={styles.subtitle}>Alert #{alert.id}</Text>
        </View>

        {/* Status Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>STATUS TIMELINE</Text>

          {timeline.map((step, index) => (
            <View key={step.label} style={styles.timelineRow}>
              <View style={styles.timelineIndicatorColumn}>
                <View
                  style={[
                    styles.timelineDot,
                    step.reached ? styles.timelineDotReached : styles.timelineDotPending,
                  ]}
                />
                {index < timeline.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      step.reached ? styles.timelineLineReached : styles.timelineLinePending,
                    ]}
                  />
                )}
              </View>

              <View style={styles.timelineTextGroup}>
                <Text
                  style={[
                    styles.timelineLabel,
                    !step.reached && styles.timelineLabelPending,
                  ]}
                >
                  {step.label}
                </Text>
                {step.timestamp && (
                  <Text style={styles.timelineTimestamp}>{formatTimestamp(step.timestamp)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Guard Info */}
        <View style={styles.card}>
        <Text style={styles.cardLabel}>RESPONDING GUARD</Text>
          {alert.guardName ? (
            <View style={styles.guardRow}>
              <Image
                source={alert.guardPhotoUrl ? { uri: alert.guardPhotoUrl } : require('../assets/contactAvatar.png')}
                style={styles.guardPhoto}
              />
              <View>
                <Text style={styles.cardValue}>{alert.guardName}</Text>
                {alert.guardPsiraNumber && (
                  <Text style={styles.guardPsira}>PSIRA #{alert.guardPsiraNumber}</Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.cardValue}>Not yet assigned</Text>
          )}
        </View>

        {/* Location */}
        {alert.locationText && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>LOCATION</Text>
            <Text style={styles.cardValue}>{alert.locationText}</Text>
          </View>
        )}

        {/* Guard Notes */}
        {alert.guardNotes && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>GUARD NOTES</Text>
            <Text style={styles.cardValue}>{alert.guardNotes}</Text>
          </View>
        )}

        {/* Rating */}
        {(canRate || alert.residentRating !== null) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              {alert.residentRating !== null ? 'YOUR RATING' : 'RATE THIS RESPONSE'}
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  disabled={!canRate}
                  onPress={() => setSelectedRating(star)}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.star,
                      displayRating !== null && star <= displayRating && styles.starFilled,
                    ]}
                  >
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>

            {canRate && (
              <Pressable
                style={[
                  styles.submitButton,
                  (!selectedRating || submittingRating) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitRating}
                disabled={!selectedRating || submittingRating}
              >
                <Text style={styles.submitButtonLabel}>
                  {submittingRating ? 'SUBMITTING...' : 'SUBMIT RATING'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  headline: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    color: colors.headingDark,
  },
  subtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.textSecondary,
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
  cardValue: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineIndicatorColumn: {
    alignItems: 'center',
    width: 16,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineDotReached: {
    backgroundColor: colors.primary,
  },
  timelineDotPending: {
    backgroundColor: colors.border,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
  },
  timelineLineReached: {
    backgroundColor: colors.primary,
  },
  timelineLinePending: {
    backgroundColor: colors.border,
  },
  timelineTextGroup: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  timelineLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  timelineLabelPending: {
    color: colors.textSecondary,
  },
  timelineTimestamp: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  star: {
    fontSize: 32,
    color: colors.border,
  },
  starFilled: {
    color: colors.primary,
  },
  submitButton: {
    height: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

  guardRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.md,
},
guardPhoto: {
  width: 48,
  height: 48,
  borderRadius: radii.lg,
  backgroundColor: colors.avatarBackground,
},
guardPsira: {
  fontFamily: typography.fontFamily.mono,
  fontSize: 13,
  color: colors.textSecondary,
  marginTop: 2,
},
});