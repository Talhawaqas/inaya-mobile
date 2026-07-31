// App.js
//
// Root entry point — sets up navigation between the three Phase 1
// screens and wraps everything in the WalletConnect provider.

import 'react-native-get-random-values'; // must be imported before ethers/crypto anywhere
import './polyfills'; // must come immediately after react-native-get-random-values, before any MetaMask Connect code
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { WalletProviderRoot } from './src/providers/WalletProvider';
import StorageDashboardScreen from './src/screens/StorageDashboardScreen';
import NodeStatusScreen from './src/screens/NodeStatusScreen';
import WalletBalanceScreen from './src/screens/WalletBalanceScreen';

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
        <ScrollView style={{ flex: 1, backgroundColor: '#0a0e14', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#ff6b6b', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            App crashed — here's why
          </Text>
          <Text style={{ color: '#ffab91', fontSize: 13, fontFamily: 'monospace', marginBottom: 16 }}>
            {this.state.error.message}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
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
    primary: '#22d3d0',
    background: '#0a0e14',
    card: '#0e1830',
    text: '#ffffff',
    border: '#1c2a38',
    notification: '#c9a24d',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <WalletProviderRoot>
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="StorageDashboard"
              screenOptions={{
                headerStyle: { backgroundColor: '#0a0e14' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '800' },
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