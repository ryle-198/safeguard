import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import BottomNavBar from '../components/BottomNavBar';
import HeaderBar from '../components/HeaderBar';

type Props = NativeStackScreenProps<RootStackParamList, 'Alert'>;

// TODO: replace with real data from GET /api/resident/alerts/history and
// GET /api/resident/alerts/{id} once the backend is wired up. Shape here
// matches the AlertResponse DTO already returned by that endpoint.
const MOCK_STATS = {
  total: 0,
  emergency: 0,
  resolved: 0,
  pending: 0,
};

type AlertStatus = 'RESOLVED' | 'PENDING' | 'CANCELLED';

interface AlertHistoryItem {
  id: string;
  title: string;
  details: string;
  time: string;
  status: AlertStatus;
}

const MOCK_ALERTS: AlertHistoryItem[] = [
  // TODO: empty for now - replace with real history. Example shape:
  // { id: '1', title: 'Emergency SOS', details: 'Guard: Jane D. • Zone 42-B', time: 'Today, 08:42 AM', status: 'RESOLVED' },
];

function statusColor(status: AlertStatus) {
  switch (status) {
    case 'RESOLVED':
      return colors.statusOnline;
    case 'PENDING':
      return colors.primary;
    case 'CANCELLED':
      return colors.textSecondary;
  }
}

export default function AlertScreen({ navigation }: Props) {
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
              <Text style={styles.boxValue}>{MOCK_STATS.total}</Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Emergency Alerts</Text>
              <Text style={styles.boxValue}>{MOCK_STATS.emergency}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Resolved</Text>
              <Text style={[styles.boxValue, { color: colors.statusOnline }]}>
                {MOCK_STATS.resolved}
              </Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>Pending</Text>
              <Text style={[styles.boxValue, { color: colors.primary }]}>
                {MOCK_STATS.pending}
              </Text>
            </View>
          </View>
        </View>

        {/* Alert History List */}
        <View style={styles.alertHistory}>
          <Text style={styles.alertHistoryTitle}>Recent Alerts</Text>

          {MOCK_ALERTS.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No alerts triggered yet.</Text>
            </View>
          ) : (
            MOCK_ALERTS.map((alert) => (
              <Pressable
                key={alert.id}
                style={styles.alertItem}
                onPress={() => {
                  // TODO: navigate to an alert detail screen once one exists,
                  // e.g. navigation.navigate('AlertDetail', { alertId: alert.id })
                }}
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