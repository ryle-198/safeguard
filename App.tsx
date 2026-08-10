import { useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
// import {
//   useFonts,
//   PublicSans_400Regular,
//   PublicSans_600SemiBold,
//   PublicSans_700Bold,
//   PublicSans_800ExtraBold,
// } from '@expo-google-fonts/public-sans';
// import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import RegisterScreen from './screens/RegisterScreen';
import VerifyOtpScreen from './screens/VerifyOtpScreen';
import SetLocationScreen from './screens/SetLocationScreen';
import ProfileScreen from './screens/ProfileScreen';
import { RootStackParamList } from './src/types/navigation';

SplashScreen.preventAutoHideAsync();

// Typed navigator - this is what lets TypeScript catch route-name typos
// like the SetLocation/SetHomeLocation mismatch that was just fixed here.
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // const [fontsLoaded] = useFonts({
  //   PublicSans_400Regular,
  //   PublicSans_600SemiBold,
  //   PublicSans_700Bold,
  //   PublicSans_800ExtraBold,
  //   JetBrainsMono_500Medium,
  // });

  // const onLayoutRootView = useCallback(async () => {
  //   if (fontsLoaded) {
  //     await SplashScreen.hideAsync();
  //   }
  // }, [fontsLoaded]);

  // if (!fontsLoaded) {
  //   return null;
  // }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
        <Stack.Screen name="SetHomeLocation" component={SetLocationScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}