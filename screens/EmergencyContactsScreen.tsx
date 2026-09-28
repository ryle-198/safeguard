import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';
import { supabase } from '../lib/supabase';
import { ensureResidentRecord } from '../lib/ensureResidentRecord';

type Props = NativeStackScreenProps<RootStackParamList, 'EmergencyContacts'>;

interface EmergencyContact {
  id: number;
  name: string;
  phone_number: string;
  relationship: string | null;
}

const MAX_CONTACTS = 3;

export default function EmergencyContactsScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const loadContacts = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('id, name, phone_number, relationship')
        .eq('resident_id', user.id)
        .order('id', { ascending: true });

      if (error) {
        console.error('Failed to load emergency contacts:', error.message);
        return;
      }

      setContacts(data ?? []);
    } catch (err) {
      console.error('Unexpected error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setRelationship('');
  };

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing information', 'Please enter at least a name and phone number.');
      return;
    }

    if (contacts.length >= MAX_CONTACTS) {
      Alert.alert('Limit reached', `You can only add up to ${MAX_CONTACTS} emergency contacts.`);
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

      try {
        await ensureResidentRecord(user.id);
      } catch {
        Alert.alert(
          'Setup error',
          'Your account setup is incomplete. Please try signing out and back in.'
        );
        return;
      }

      const { error } = await supabase.from('emergency_contacts').insert({
        resident_id: user.id,
        name: name.trim(),
        phone_number: phone.trim(),
        relationship: relationship.trim() || null,
      });

      if (error) {
        // The database trigger raises this exact message if the limit is
        // somehow hit anyway (e.g. a race condition) - surface it as-is.
        console.error('Failed to add contact:', error.message);
        Alert.alert('Unable to add contact', error.message);
        return;
      }

      resetForm();
      await loadContacts();
    } catch (err) {
      console.error('Unexpected error adding contact:', err);
      Alert.alert('Something went wrong', 'The contact could not be added.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveContact = (contact: EmergencyContact) => {
    Alert.alert('Remove contact', `Remove ${contact.name} from your emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('emergency_contacts')
            .delete()
            .eq('id', contact.id);

          if (error) {
            console.error('Failed to remove contact:', error.message);
            Alert.alert('Unable to remove contact', error.message);
            return;
          }

          await loadContacts();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Emergency Contacts</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Add up to {MAX_CONTACTS} people who should be notified if you trigger an SOS alert.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.contactList}>
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactAvatar} />
                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactMeta}>
                    {contact.phone_number}
                    {contact.relationship ? ` • ${contact.relationship}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => handleRemoveContact(contact)} hitSlop={8}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}

            {contacts.length === 0 && (
              <Text style={styles.emptyText}>No emergency contacts added yet.</Text>
            )}
          </View>
        )}

        {contacts.length < MAX_CONTACTS ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Add a Contact</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={colors.textPlaceholder}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="+27 00 000 000"
                placeholderTextColor={colors.textPlaceholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>RELATIONSHIP (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Spouse, Parent, Friend"
                placeholderTextColor={colors.textPlaceholder}
                value={relationship}
                onChangeText={setRelationship}
              />
            </View>

            <Pressable
              style={[styles.addButton, saving && styles.addButtonDisabled]}
              onPress={handleAddContact}
              disabled={saving}
            >
              <Text style={styles.addButtonLabel}>
                {saving ? 'ADDING...' : 'ADD CONTACT'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.limitReachedText}>
            You've reached the {MAX_CONTACTS}-contact limit. Remove one to add another.
          </Text>
        )}
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
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  contactList: {
    gap: spacing.sm,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.avatarBackground,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  contactMeta: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    color: colors.deleteRed,
  },
  emptyText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  form: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.dividerBorder,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formTitle: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
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
    paddingVertical: 12,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  addButton: {
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  limitReachedText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});