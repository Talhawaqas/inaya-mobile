// App.js
//
// Root entry point — sets up navigation and wraps everything in the
// WalletConnect provider.
//
// Navigation was originally a bottom tab bar; switched to a left-side
// drawer (opened via a hamburger icon) per user feedback that the bottom
// tabs were hard to see/tap. react-native-gesture-handler's import MUST be
// the very first line in the entry file (its own setup requirement,
// unrelated to the react-native-get-random-values/ethers ordering below).

import 'react-native-gesture-handler';
import 'react-native-get-random-values'; // must be imported before ethers/crypto anywhere
import './polyfills'; // must come immediately after react-native-get-random-values, before any MetaMask Connect code
import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
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
import { CardCustomerProviderRoot } from './src/providers/CardCustomerProvider';
import StorageDashboardScreen from './src/screens/StorageDashboardScreen';
import NodeStatusScreen from './src/screens/NodeStatusScreen';
import WalletBalanceScreen from './src/screens/WalletBalanceScreen';
import UploadScreen from './src/screens/UploadScreen';
import DownloadScreen from './src/screens/DownloadScreen';
import MyFilesScreen from './src/screens/MyFilesScreen';
import BusinessModelScreen from './src/screens/BusinessModelScreen';
import StakingScreen from './src/screens/StakingScreen';
import MyDashboardScreen from './src/screens/MyDashboardScreen';
import WhitePaperScreen from './src/screens/WhitePaperScreen';
import KnowledgeBaseScreen from './src/screens/KnowledgeBaseScreen';
import AIAssistantScreen from './src/screens/AIAssistantScreen';
import ReferralScreen from './src/screens/ReferralScreen';
import BusinessWorkspaceStack from './src/screens/business/BusinessWorkspaceStack';
import SaaSRoadmapScreen from './src/screens/SaaSRoadmapScreen';
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
const Drawer = createDrawerNavigator();

// Home keeps its own stack so StorageDashboard can still push into
// NodeStatus/WalletBalance/Upload/Download/MyFiles exactly as before —
// nothing in those screens' navigation.navigate() calls needed to change.
// Its own header is hidden (headerShown: false below) since
// StorageDashboardScreen renders its own brand header with the hamburger
// button that opens the drawer — showing both would double up.
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
      <Stack.Screen name="StorageDashboard" component={StorageDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NodeStatus" component={NodeStatusScreen} options={{ title: 'Watcher Node Status' }} />
      <Stack.Screen name="WalletBalance" component={WalletBalanceScreen} options={{ title: 'Wallet Balance' }} />
      <Stack.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload' }} />
      <Stack.Screen name="Download" component={DownloadScreen} options={{ title: 'Download' }} />
      <Stack.Screen name="MyFiles" component={MyFilesScreen} options={{ title: 'My Files' }} />
    </Stack.Navigator>
  );
}

const DRAWER_ICONS = {
  Home: 'home-outline',
  Business: 'briefcase-outline',
  Workspace: 'lock-closed-outline',
  SaaSRoadmap: 'map-outline',
  Staking: 'trending-up-outline',
  Dashboard: 'grid-outline',
  WhitePaper: 'document-text-outline',
  KnowledgeBase: 'megaphone-outline',
  AIAssistant: 'chatbubble-ellipses-outline',
  Referrals: 'people-outline',
};

const DRAWER_LABELS = {
  Home: 'Home',
  Business: 'Business',
  Workspace: 'Business Workspace',
  SaaSRoadmap: 'Business SaaS Roadmap',
  Staking: 'Staking',
  Dashboard: 'Dashboard',
  WhitePaper: 'White Paper',
  KnowledgeBase: 'Knowledge Base',
  AIAssistant: 'Ask AI',
  Referrals: 'Referrals',
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

// Same three community links as the web dApp's socialLinksList
// (inaya-network-dapp/src/app/page.js) — kept in sync manually, same as
// the knowledge base articles. Plain https:// links: Linking.openURL
// already hands off to the native YouTube/X/Telegram app via iOS
// Universal Links / Android App Links when it's installed, so no custom
// URL scheme or app.json config is needed for that behavior.
const SOCIAL_LINKS = [
  { label: 'Telegram', href: 'https://t.me/inayanetwork', icon: 'paper-plane' },
  { label: 'YouTube', href: 'https://youtube.com/@inayanetworkofficial?si=GzAzY5m3PzZy8MU-', icon: 'logo-youtube' },
  { label: 'X', href: 'https://x.com/InayaNetwork', icon: 'logo-twitter' },
];

// Branded header above the auto-generated nav item list, and a social-
// links row pinned below it at the bottom of the drawer — the only two
// custom parts; DrawerItemList in between handles everything else
// (active/inactive styling comes from screenOptions in AppNavigator).
function CustomDrawerContent(props) {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ backgroundColor: colors.navBar, flexGrow: 1, paddingTop: 0 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8 }}>
        <Text style={{ fontFamily: fonts.sansExtraBold, fontSize: 18, color: colors.textPrimary, letterSpacing: 1 }}>INAYA</Text>
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.cyan, letterSpacing: 2, marginTop: -2 }}>NETWORK</Text>
      </View>
      <DrawerItemList {...props} />
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 20, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}>
        {SOCIAL_LINKS.map((social) => (
          <TouchableOpacity
            key={social.label}
            onPress={() => Linking.openURL(social.href)}
            accessibilityLabel={social.label}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,242,254,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={social.icon} color={colors.textMuted} size={18} />
          </TouchableOpacity>
        ))}
      </View>
    </DrawerContentScrollView>
  );
}

// Bottom tabs were hard for some users to see/tap — replaced with a
// left-side drawer opened via a hamburger icon per that feedback. Every
// screen still has an automatic header+hamburger from the Drawer itself,
// except Home: its nested stack (see HomeStack above) hides its own
// duplicate header, and StorageDashboardScreen renders its own brand
// header with a hamburger button (navigation.getParent()?.openDrawer())
// instead.
function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Drawer.Navigator
        initialRouteName="Home"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={({ route }) => ({
          headerShown: route.name !== 'Home' && route.name !== 'Workspace',
          headerStyle: { backgroundColor: colors.navBar },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.sansExtraBold, fontSize: 16 },
          headerShadowVisible: false,
          drawerStyle: { backgroundColor: colors.navBar, width: 260 },
          drawerActiveTintColor: colors.cyan,
          drawerInactiveTintColor: colors.textMuted,
          drawerActiveBackgroundColor: 'rgba(0,242,254,0.08)',
          drawerLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 13, marginLeft: -8 },
          drawerIcon: ({ color, size }) => <Ionicons name={DRAWER_ICONS[route.name]} color={color} size={size ?? 20} />,
        })}
      >
        <Drawer.Screen name="Home" component={HomeStack} options={{ title: DRAWER_LABELS.Home }} />
        <Drawer.Screen name="Business" component={BusinessModelScreen} options={{ title: DRAWER_LABELS.Business }} />
        <Drawer.Screen name="Workspace" component={BusinessWorkspaceStack} options={{ title: DRAWER_LABELS.Workspace }} />
        <Drawer.Screen name="SaaSRoadmap" component={SaaSRoadmapScreen} options={{ title: DRAWER_LABELS.SaaSRoadmap }} />
        <Drawer.Screen name="Staking" component={StakingScreen} options={{ title: DRAWER_LABELS.Staking }} />
        <Drawer.Screen name="Dashboard" component={MyDashboardScreen} options={{ title: DRAWER_LABELS.Dashboard }} />
        <Drawer.Screen name="WhitePaper" component={WhitePaperScreen} options={{ title: DRAWER_LABELS.WhitePaper }} />
        <Drawer.Screen name="KnowledgeBase" component={KnowledgeBaseScreen} options={{ title: DRAWER_LABELS.KnowledgeBase }} />
        <Drawer.Screen name="AIAssistant" component={AIAssistantScreen} options={{ title: DRAWER_LABELS.AIAssistant }} />
        <Drawer.Screen name="Referrals" component={ReferralScreen} options={{ title: DRAWER_LABELS.Referrals }} />
      </Drawer.Navigator>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <WalletProviderRoot>
            <CardCustomerProviderRoot>
              <AppNavigator />
            </CardCustomerProviderRoot>
          </WalletProviderRoot>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}