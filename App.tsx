import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import {
  StatusBar,
  View,
  ActivityIndicator,
} from 'react-native';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import RegisterScreen from './screens/RegisterScreen';
import SetLocationScreen from './screens/SetLocationScreen';
import ProfileScreen from './screens/ProfileScreen';
import AlertsScreen from './screens/AlertScreen';
import ActiveAlertScreen from './screens/ActiveAlertScreen';
import EmailVerificationScreen from './screens/EmailVerificationScreen';
import EmergencyContactsScreen from './screens/EmergencyContactsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import GuardHomeScreen from './screens/GuardHomeScreen';
import GuardAlertsScreen from './screens/GuardAlertsScreen';
import GuardActiveAlertScreen from './screens/GuardActiveAlertScreen';
import AlertDetail from './screens/AlertDetail';
import ReportActivityScreen from './screens/ReportActivityScreen';
import CommunityScreen from './screens/CommunityScreen';
import HotspotMapScreen from './screens/HotspotMapScreen';
import { Alert, Platform } from 'react-native';

import { RootStackParamList } from './src/types/navigation';
import { useAuthRole } from './src/hooks/useAuthRole';
import { colors } from './theme/tokens';
import { supabase } from './lib/supabase';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { initializing, session, role } = useAuthRole();

  const [residentHasHomeLocation, setResidentHasHomeLocation] = useState<
    boolean | null
  >(null);

  if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const text = message ? `${title}\n\n${message}` : title;

    // No buttons, or a single button: plain alert, then run its handler.
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }

    // Two or more buttons: confirm() OK runs the action, Cancel runs the cancel button.
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    const actionButton = buttons.find((b) => b !== cancelButton) ?? buttons[0];

    if (window.confirm(text)) {
      actionButton.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }
  };
}

  useEffect(() => {
    let cancelled = false;

    if (role !== 'RESIDENT') {
      setResidentHasHomeLocation(null);
      return;
    }

    const checkHomeLocation = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setResidentHasHomeLocation(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('residents')
          .select('residents_home_location_text')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error(
            'Failed to check resident home location:',
            error.message
          );

          if (!cancelled) {
            setResidentHasHomeLocation(true);
          }
          return;
        }

        if (!cancelled) {
          setResidentHasHomeLocation(
            Boolean(data?.residents_home_location_text)
          );
        }
      } catch (error) {
        console.error('Unexpected home location check error:', error);

        if (!cancelled) {
          setResidentHasHomeLocation(true);
        }
      }
    };

    checkHomeLocation();

    return () => {
      cancelled = true;
    };
  }, [role]);

  const stillResolvingResident =
    role === 'RESIDENT' && residentHasHomeLocation === null;

  if (initializing || stillResolvingResident) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
      />

      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!session ? (
            // ---------------- AUTH ----------------
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
            </>
          ) : role === 'GUARD' ? (
            // ---------------- GUARD ----------------
            <>
              <Stack.Screen name="GuardHome" component={GuardHomeScreen} />
              <Stack.Screen name="GuardAlerts" component={GuardAlertsScreen} />
              <Stack.Screen
                name="GuardActiveAlert"
                component={GuardActiveAlertScreen}
                options={{ gestureEnabled: false }}
              />
            </>
          ) : role === 'RESIDENT' ? (
            // ---------------- RESIDENT ----------------
            residentHasHomeLocation ? (
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="SetHomeLocation" component={SetLocationScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Alert" component={AlertsScreen} />
                <Stack.Screen
                  name="ActiveAlert"
                  component={ActiveAlertScreen}
                  options={{ gestureEnabled: false }}
                />
                <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                <Stack.Screen name="AlertDetail" component={AlertDetail} />
                <Stack.Screen name="ReportActivity" component={ReportActivityScreen} />
                <Stack.Screen name="Community" component={CommunityScreen} />
                <Stack.Screen name="HotspotMap" component={HotspotMapScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="SetHomeLocation" component={SetLocationScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Alert" component={AlertsScreen} />
                <Stack.Screen
                  name="ActiveAlert"
                  component={ActiveAlertScreen}
                  options={{ gestureEnabled: false }}
                />
                <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              </>
            )
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}