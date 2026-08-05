import { SafeAreaView } from 'react-native-safe-area-context';
import { Text ,View, Image, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

const ASSETS = {
    headerShieldIcon: require('../assets/shield.png'),

}
export default function HeaderBar(){

return(
    <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerContent}>
            <Image source={ASSETS.headerShieldIcon} style={styles.headerIcon} />
            <Text style={styles.wordmark}>SAFEGUARD</Text>
        </View>
    </SafeAreaView>

        )
    }

    const styles = StyleSheet.create({
        header: {
            height: 100,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.dividerBorder,
            justifyContent: 'center',
          },
          headerContent: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          },

        wordmark: {
        fontFamily: typography.fontFamily.extraBold,
        fontSize: typography.wordmark.fontSize,
        lineHeight: typography.wordmark.lineHeight,
        letterSpacing: typography.wordmark.letterSpacing,
        color: colors.primary,
    },

        headerIcon: {
        width: 16,
        height: 20,
        resizeMode: 'contain',
        }
    });