// App.js
//
// Root entry point — sets up navigation between the three Phase 1
// screens and wraps everything in the WalletConnect provider.

import 'react-native-get-random-values'; // must be imported before ethers/crypto anywhere
import './polyfills'; // must come immediately after react-native-get-random-values, before any MetaMask Connect code
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
import BusinessModelScreen from './src/screens/BusinessModelScreen';
import StakingScreen from './src/screens/StakingScreen';
import MyDashboardScreen from './src/screens/MyDashboardScreen';
import WhitePaperScreen from './src/screens/WhitePaperScreen';
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
const Tab = createBottomTabNavigator();

// Home tab keeps its own stack so StorageDashboard can still push into
// NodeStatus/WalletBalance exactly as before — nothing in those three
// screens' navigation.navigate() calls needed to change.
function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navBar },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fonts.sansExtraBold, fontSize: 16 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="StorageDashboard" component={StorageDashboardScreen} options={{ title: 'Storage Dashboard' }} />
      <Stack.Screen name="NodeStatus" component={NodeStatusScreen} options={{ title: 'Watcher Node Status' }} />
      <Stack.Screen name="WalletBalance" component={WalletBalanceScreen} options={{ title: 'Wallet Balance' }} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  Home: 'home',
  Business: 'briefcase',
  Staking: 'trending-up',
  Dashboard: 'grid',
  WhitePaper: 'document-text',
};

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

// Rendered inside SafeAreaProvider so it can read the device's actual
// safe-area insets (notch, gesture nav bar) — App() itself can't call
// useSafeAreaInsets() since it's the one rendering the provider, not a
// descendant of it. A fixed tabBarStyle.height (as this had before)
// replaces React Navigation's own automatic safe-area handling for the
// tab bar instead of adding to it, which is what let the tab bar overlap
// the system gesture area and cut off screen content on real devices.
function AppNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 54 + insets.bottom;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.cyan,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.navBar,
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingBottom: insets.bottom + 6,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 10 },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name]} color={color} size={size ? size - 2 : 20} />
          ),
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Business" component={BusinessModelScreen} options={{ title: 'Business' }} />
        <Tab.Screen name="Staking" component={StakingScreen} />
        <Tab.Screen name="Dashboard" component={MyDashboardScreen} options={{ title: 'Dashboard' }} />
        <Tab.Screen name="WhitePaper" component={WhitePaperScreen} options={{ title: 'Paper' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

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
          <AppNavigator />
        </WalletProviderRoot>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}