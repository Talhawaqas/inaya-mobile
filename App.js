// App.js
//
// Root entry point — sets up navigation between the three Phase 1
// screens and wraps everything in the WalletConnect provider.

import 'react-native-get-random-values'; // must be imported before ethers/crypto anywhere
import './polyfills'; // must come immediately after react-native-get-random-values, before any MetaMask Connect code
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { WalletProviderRoot } from './src/providers/WalletProvider';
import StorageDashboardScreen from './src/screens/StorageDashboardScreen';
import NodeStatusScreen from './src/screens/NodeStatusScreen';
import WalletBalanceScreen from './src/screens/WalletBalanceScreen';
import { colors, fonts } from './src/theme';

// General safety net for any render-time crash NOT already caught by
// WalletProvider's own try/catch around createAppKit() — shows the real
// error on-screen instead of the OS's generic "app isn't working" dialog.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 }}>
          <Text style={{ color: colors.danger, fontSize: 18, fontFamily: fonts.sansExtraBold, marginBottom: 12 }}>
            App crashed — here's why
          </Text>
          <Text style={{ color: colors.warning, fontSize: 13, fontFamily: fonts.mono, marginBottom: 16 }}>
            {this.state.error.message}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: fonts.mono }}>
            {this.state.error.stack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const Stack = createNativeStackNavigator();

// Extends React Navigation's own DarkTheme rather than writing a theme
// object from scratch — v7 made `fonts` a required theme property, and a
// hand-written theme missing it causes exactly this crash:
// "Cannot read property 'regular' of undefined" inside useHeaderConfigProps.
const navTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.cyan,
    background: colors.bg,
    card: colors.navBar,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.warning,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <WalletProviderRoot>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="StorageDashboard"
              screenOptions={{
                headerStyle: { backgroundColor: colors.navBar },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { fontFamily: fonts.sansExtraBold, fontSize: 16 },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen
                name="StorageDashboard"
                component={StorageDashboardScreen}
                options={{ title: 'Storage Dashboard' }}
              />
              <Stack.Screen
                name="NodeStatus"
                component={NodeStatusScreen}
                options={{ title: 'Watcher Node Status' }}
              />
              <Stack.Screen
                name="WalletBalance"
                component={WalletBalanceScreen}
                options={{ title: 'Wallet Balance' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </WalletProviderRoot>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}