import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../src/types/navigation';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'VerifyOtp'
>;

// TODO: temporary Figma-hosted URLs, expire ~7 days after export - see
// screens/LoginScreen.js for the export-and-replace steps.
const ASSETS = {
  timerIcon: 'https://www.figma.com/api/mcp/asset/6b31a840-2fd5-43cf-9efd-ae53e50b28cb',
  resendIcon: 'https://www.figma.com/api/mcp/asset/9908dc08-7c43-4b8e-a80b-561fe584de81',
  continueArrowIcon: 'https://www.figma.com/api/mcp/asset/b02aed64-6f58-42cb-a9e6-61f8b5ff825e',
  backArrowIcon: 'https://www.figma.com/api/mcp/asset/1ec8c961-e10c-40a6-a33c-36b1512484d9',
  vaultShieldIcon: 'https://www.figma.com/api/mcp/asset/a1b8b71a-6912-49fd-aa9f-462df8eabc0e',
  headerShieldIcon: require('../assets/shield.png'),
};

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 165; // 02:45, matching the Figma design

export default function VerifyOtpScreen({ navigation, route }: Props) {
  const phoneNumber = route?.params?.phoneNumber || '+27 00 000 000';

const [digits, setDigits] = useState<string[]>(
  Array(OTP_LENGTH).fill('')
);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const formattedTime = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
    secondsLeft % 60
  ).padStart(2, '0')}`;

  const handleChangeDigit = (value: string, index: number) => {
    // Only keep the last character typed, digits only
    const clean = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e:any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    // TODO: wire up to POST /api/auth/resend-otp with { phoneNumber }.
    setSecondsLeft(EXPIRY_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  const handleContinue = () => {
    // TODO: wire up to POST /api/auth/verify-otp with { phoneNumber, otpCode: digits.join('') }.
    // For now (frontend-only phase) it just navigates straight to Home.
    navigation.navigate('SetHomeLocation');
  };

  return (
    <View style={styles.root}>
      {/* Header - Top AppBar */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            <Image source={ASSETS.headerShieldIcon} style={styles.headerIcon} />
            <Text style={styles.wordmark}>SAFEGUARD</Text>
          </View>
          <Text style={styles.stepIndicator}>Step 2 of 3</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Typography Header */}
            <Text style={styles.title}>Verify Identity</Text>
            <Text style={styles.subtitle}>
              A secure authentication request has been initiated. Enter the 6-digit code sent to{' '}
              <Text style={styles.subtitleEmphasis}>{phoneNumber}</Text>.
            </Text>

            {/* OTP Input Section */}
            <View style={styles.otpSection}>
              <View style={styles.otpRow}>
                {digits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
  inputRefs.current[index] = ref;
}}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={value => handleChangeDigit(value, index)}
                    onKeyPress={e => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>

              <View style={styles.resendRow}>
                <View style={styles.timerGroup}>
                  <Image source={{ uri: ASSETS.timerIcon }} style={styles.smallIcon} />
                  <Text style={styles.timerText}>
                    {secondsLeft > 0 ? `Expires in ${formattedTime}` : 'Code expired'}
                  </Text>
                </View>
                <Pressable style={styles.resendGroup} onPress={handleResend}>
                  <Text style={styles.resendText}>Resend Code</Text>
                  <Image source={{ uri: ASSETS.resendIcon }} style={styles.resendIcon} />
                </Pressable>
              </View>
            </View>

            {/* Primary Actions */}
            <View style={styles.actions}>
              <Pressable style={styles.continueButton} onPress={handleContinue}>
                <Text style={styles.continueButtonLabel}>CONTINUE</Text>
                <Image source={{ uri: ASSETS.continueArrowIcon }} style={styles.continueIcon} />
              </Pressable>

              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <Image source={{ uri: ASSETS.backArrowIcon }} style={styles.backIcon} />
                <Text style={styles.backButtonLabel}>BACK TO PHONE ENTRY</Text>
              </Pressable>
            </View>

            {/* Security Badge */}
            <View style={styles.vaultBadge}>
              <Image source={{ uri: ASSETS.vaultShieldIcon }} style={styles.vaultIcon} />
              <Text style={styles.vaultText}>
                Encrypted identity verification via Safeguard Vault
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.verifyBackground,
  },
  header: {
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.enrollmentHeaderBorder,
  },
  headerRow: {
    height: 64,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    width: 16,
    height: 20,
    resizeMode: 'contain',
  },
  wordmark: {
    fontFamily: typography.fontFamily.extraBold,
    fontSize: typography.wordmark.fontSize,
    lineHeight: typography.wordmark.lineHeight,
    letterSpacing: typography.wordmark.letterSpacing,
    color: colors.primary,
  },
  stepIndicator: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.36,
    color: colors.stepLabel,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 40,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.xl,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 28,
    lineHeight: 36,
    color: colors.textDark,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.stepLabel,
    marginTop: spacing.sm,
  },
  subtitleEmphasis: {
    fontFamily: typography.fontFamily.semiBold,
    color: colors.textDark,
    letterSpacing: 0.4,
  },
  otpSection: {
    gap: spacing.xl,
  },
  otpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.otpBorder,
    borderRadius: radii.md,
    fontFamily: typography.fontFamily.bold,
    fontSize: 24,
    color: colors.textDark,
  },
  otpBoxFilled: {
    borderColor: colors.otpFocusBorder,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  smallIcon: {
    width: 13,
    height: 13,
    resizeMode: 'contain',
  },
  timerText: {
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.36,
    color: colors.stepLabel,
  },
  resendGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resendText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    letterSpacing: typography.button.letterSpacing,
    color: colors.resendRed,
  },
  resendIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
  },
  actions: {
    gap: spacing.lg,
  },
  continueButton: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  continueButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  continueIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  backButton: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.otpBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  backIcon: {
    width: 7.4,
    height: 12,
    resizeMode: 'contain',
  },
  backButtonLabel: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.stepLabel,
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.enrollmentHeaderBorder,
    borderRadius: radii.md * 2,
    padding: 17,
  },
  vaultIcon: {
    width: 16,
    height: 20,
    resizeMode: 'contain',
  },
  vaultText: {
    flex: 1,
    fontFamily: typography.fontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.36,
    color: colors.stepLabel,
  },
});