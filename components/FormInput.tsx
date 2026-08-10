import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

/**
 * Bordered text input with a leading icon, matching the "Identifier Input" /
 * "Password Input" pattern from the Figma Login screen. Reused wherever a
 * labeled text field appears in later screens.
 */

interface FormInputProps extends TextInputProps{
  label: string;
  icon?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  labelAccessory?: React.ReactNode;
 
}

export default function FormInput({
  label,
  icon,
  rightAccessory,
  labelAccessory,
  ...textInputProps
}: FormInputProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>
      <View style={styles.border}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : null]}
          placeholderTextColor={colors.textPlaceholder}
          {...textInputProps}
        />
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: typography.fontFamily.semiBold,
    fontWeight: '600',
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textPrimary,
  },
  border: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.sm,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  icon: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 1,
  },
  rightAccessory: {
    position: 'absolute',
    right: spacing.md,
  },
  input: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    fontFamily: typography.fontFamily.regular,
    fontWeight: '400',
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  inputWithIcon: {
    paddingLeft: 40,
  },
});
