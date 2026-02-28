import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppProvider, useAppContext } from '@/context/AppContext';
import { AuthProvider } from '@/context/AuthContext';
import { AuthGate } from '@/components/auth/AuthGate';
import GlobalUI from '@/components/GlobalUI';

function RootLayoutNav() {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="note/[id]" options={{ headerShown: false }} />
        </Stack>
        <GlobalUI />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </AuthGate>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppProvider>
        <RootLayoutNav />
      </AppProvider>
    </AuthProvider>
  );
}
