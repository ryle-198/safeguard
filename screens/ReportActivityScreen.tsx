import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';
import { ensureResidentRecord } from '../lib/ensureResidentRecord';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportActivity'>;

const INCIDENT_TYPES = [
  'Suspicious Person',
  'Suspicious Vehicle',
  'Noise Disturbance',
  'Property Damage',
  'Break-In Attempt',
  'Other',
];

export default function ReportActivityScreen({ navigation }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Select an incident type', 'Please choose what you\'re reporting.');
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }

      try {
        await ensureResidentRecord(user.id);
      } catch {
        Alert.alert(
          'Setup error',
          'Your account setup is incomplete. Please try signing out and back in.'
        );
        return;
      }

      // Reports use the device's current location if available, falling
      // back to the resident's saved home location isn't done here to keep
      // this simple - a missing location just blocks submission with a
      // clear message instead of guessing.
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Location required', 'Please enable location access to submit a report.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const point = `POINT(${location.coords.longitude} ${location.coords.latitude})`;

      const incidentType = description.trim()
        ? `${selectedType}: ${description.trim()}`
        : selectedType;

      const { error } = await supabase.from('alerts').insert({
        resident_id: user.id,
        resident_location: point,
        status: 'PENDING',
        incident_type: incidentType,
      });

      if (error) {
        console.error('Failed to submit report:', error.message);
        Alert.alert('Unable to submit report', error.message);
        return;
      }

      Alert.alert('Report submitted', 'Thank you - your report has been logged.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Unexpected error submitting report:', err);
      Alert.alert('Something went wrong', 'Your report could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Report Activity</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Report suspicious activity in your area. This is logged for guard follow-up and does
          not trigger an emergency dispatch - use the SOS button for that instead.
        </Text>

        <View style={styles.typeGrid}>
          {INCIDENT_TYPES.map((type) => {
            const active = selectedType === type;
            return (
              <Pressable
                key={type}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add any additional details..."
            placeholderTextColor={colors.textPlaceholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonLabel}>
            {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
          </Text>
        </Pressable>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backArrow: {
    fontSize: 28,
    color: colors.primary,
    width: 24,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 17,
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBackground,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 13,
    color: colors.textPrimary,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textSecondary,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});