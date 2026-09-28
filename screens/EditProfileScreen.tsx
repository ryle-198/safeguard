import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [homeAddressLabel, setHomeAddressLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Failed to load profile for editing:', profileError.message);
      } else {
        setFullName(profile?.full_name ?? '');
      }

      const { data: resident, error: residentError } = await supabase
        .from('residents')
        .select('home_address_label')
        .eq('user_id', user.id)
        .maybeSingle();

      if (residentError) {
        console.error('Failed to load home address:', residentError.message);
      } else {
        setHomeAddressLabel(resident?.home_address_label ?? null);
      }
    } catch (err) {
      console.error('Unexpected error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Re-fetch the home address when this screen regains focus, so it
  // reflects any change just made on SetLocationScreen without needing a
  // full remount.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProfile();
    });

    return unsubscribe;
  }, [navigation]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to save profile:', error.message);
        Alert.alert('Unable to save', error.message);
        return;
      }

      navigation.goBack();
    } catch (err) {
      console.error('Unexpected error saving profile:', err);
      Alert.alert('Something went wrong', 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textPlaceholder}
                  value={fullName}
                  onChangeText={setFullName}
                  autoFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>HOME ADDRESS</Text>
                <Pressable
                  style={styles.addressRow}
                  onPress={() => navigation.navigate('SetHomeLocation')}
                >
                  <Text
                    style={[
                      styles.addressText,
                      !homeAddressLabel && styles.addressTextPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {homeAddressLabel ?? 'No home address set'}
                  </Text>
                  <Text style={styles.addressChangeLabel}>Change</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonLabel}>{saving ? 'SAVING...' : 'SAVE CHANGES'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
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
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
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
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: typography.fontFamily.regular,
    fontSize: 18,
    color: colors.textPrimary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  addressText: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  addressTextPlaceholder: {
    color: colors.textPlaceholder,
  },
  addressChangeLabel: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: 14,
    color: colors.primary,
  },
  saveButton: {
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});