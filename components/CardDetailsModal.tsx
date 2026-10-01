import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { supabase } from '../lib/supabase';

export type SavedCard = {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (card: SavedCard) => void;
};

type Method = 'Visa' | 'Mastercard';

const luhnValid = (digits: string) => {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

const detectBrand = (digits: string): Method | null => {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'Mastercard';
  return null;
};

function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
    </View>
  );
}

export default function CardDetailsModal({ visible, onClose, onSaved }: Props) {
  // Card number and CVV live only in component state and are cleared on close/save.
  const [method, setMethod] = useState<Method | null>(null);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('South Africa');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setMethod(null);
    setNumber('');
    setExpiry('');
    setCvv('');
    setFirstName('');
    setLastName('');
    setAddress1('');
    setAddress2('');
    setCity('');
    setPostalCode('');
    setCountry('South Africa');
    setPhone('');
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const formatNumber = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handleSave = async () => {
    setError('');
    const digits = number.replace(/\s/g, '');
    const [mm, yy] = expiry.split('/');
    const month = Number(mm);
    const year = 2000 + Number(yy);

    if (!method) return setError('Please select a payment method.');
    if (digits.length < 13 || !luhnValid(digits)) {
      return setError('That card number does not look valid.');
    }
    if (detectBrand(digits) !== method) {
      return setError(`That card number does not look like a ${method} card.`);
    }
    if (!mm || !yy || yy.length !== 2 || month < 1 || month > 12) {
      return setError('Enter the expiry as MM/YY.');
    }
    const now = new Date();
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      return setError('That card has expired.');
    }
    if (cvv.length < 3) return setError('Enter the 3 or 4 digit security code.');

    if (!firstName.trim() || !lastName.trim()) {
      return setError('Enter your first and last name.');
    }
    if (!address1.trim()) return setError('Enter your billing address.');
    if (!city.trim()) return setError('Enter your city.');
    if (!postalCode.trim()) return setError('Enter your zip or postal code.');
    if (!country.trim()) return setError('Enter your country.');
    if (phone.replace(/\D/g, '').length < 9) {
      return setError('Enter a valid phone number.');
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not signed in.');

      // Card: only brand, last 4 and expiry are stored. Number and CVV are discarded.
      const card: SavedCard = {
        brand: method,
        last4: digits.slice(-4),
        exp_month: month,
        exp_year: year,
      };

      const { error: dbError } = await supabase.from('demo_payment_methods').upsert({
        user_id: user.id,
        ...card,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        address_line1: address1.trim(),
        address_line2: address2.trim() || null,
        city: city.trim(),
        postal_code: postalCode.trim(),
        country: country.trim(),
        phone: phone.trim(),
        updated_at: new Date().toISOString(),
      });
      if (dbError) throw dbError;

      reset();
      onSaved(card);
    } catch (e: any) {
      setError(e?.message || 'Could not save the card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Please select a payment method</Text>

            <View style={styles.demoBanner}>
              <Text style={styles.demoText}>
                DEMO ONLY. Use a test card such as 4111 1111 1111 1111 (Visa) or
                5555 5555 5555 4444 (Mastercard) and fake billing details. Only the
                brand, last 4 digits, expiry and billing details are kept. The full
                number and security code are discarded.
              </Text>
            </View>

            <View style={styles.methodRow}>
              {(['Visa', 'Mastercard'] as Method[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.method, method === m && styles.methodActive]}
                  onPress={() => setMethod(m)}
                >
                  <Text
                    style={[styles.methodText, method === m && styles.methodTextActive]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Field
              label="Card number"
              value={number}
              onChangeText={(v) => setNumber(formatNumber(v))}
              keyboardType="number-pad"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="Expiration date"
                  value={expiry}
                  onChangeText={(v) => setExpiry(formatExpiry(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="Security code"
                  value={cvv}
                  onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="123"
                  secureTextEntry
                  maxLength={4}
                />
              </View>
            </View>

            <Text style={styles.section}>BILLING INFORMATION</Text>

            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <Field
              label="Billing address"
              value={address1}
              onChangeText={setAddress1}
              autoCapitalize="words"
            />
            <Field
              label="Billing address, line 2 (optional)"
              value={address2}
              onChangeText={setAddress2}
              autoCapitalize="words"
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.half}>
                <Field
                  label="Zip or postal code"
                  value={postalCode}
                  onChangeText={setPostalCode}
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </View>
            </View>

            <Field
              label="Country"
              value={country}
              onChangeText={setCountry}
              autoCapitalize="words"
            />
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primary, saving && styles.disabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>SAVE CARD AND CONTINUE</Text>
              )}
            </Pressable>

            <Pressable onPress={close}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '92%',
  },
  content: { padding: spacing.lg, gap: spacing.sm },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 20,
    color: colors.profileHeading,
  },
  demoBanner: {
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: '#F5D48F',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  demoText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#7A5200',
  },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  method: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodActive: { borderColor: colors.accentRed, backgroundColor: '#FDECEC' },
  methodText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  methodTextActive: { color: colors.accentRed },
  section: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  field: { gap: 4 },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fontFamily.regular,
    fontSize: 16,
    color: colors.profileHeading,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  error: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: '#B42318',
  },
  primary: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  disabled: { opacity: 0.6 },
  primaryText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  cancel: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
});