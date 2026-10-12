import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppFonts } from './src/hooks/useAppFonts';

void SplashScreen.preventAutoHideAsync();

export default function App(): React.JSX.Element | null {
  const areFontsReady = useAppFonts();

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (areFontsReady) void hideSplash();
  }, [areFontsReady, hideSplash]);

  if (!areFontsReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
