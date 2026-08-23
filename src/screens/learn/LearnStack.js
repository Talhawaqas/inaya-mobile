// src/screens/learn/LearnStack.js
//
// Entry point wired into App.js's drawer as "Learn". No auth gate — Inaya
// Learn works with no wallet connected (local-only saved/progress);
// connecting a wallet just turns on backend sync, handled inside
// useLearnLibrary, not here. Mirrors BusinessWorkspaceStack.js's shared
// screenOptions/header styling.

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';
import LearnHomeScreen from './LearnHomeScreen';
import LearnSearchResultsScreen from './LearnSearchResultsScreen';
import LearnVideoScreen from './LearnVideoScreen';
import LearnMyLearningScreen from './LearnMyLearningScreen';
import LearnCategoryScreen from './LearnCategoryScreen';
import AiTutorButton from '../../components/learn/AiTutorButton';

const Stack = createNativeStackNavigator();

export default function LearnStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navBar },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fonts.sansExtraBold, fontSize: 15 },
        headerShadowVisible: false,
        headerRight: () => <AiTutorButton />,
      }}
    >
      <Stack.Screen
        name="LearnHome"
        component={LearnHomeScreen}
        options={({ navigation }) => ({
          title: 'Inaya Learn',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <AiTutorButton />
              <TouchableOpacity onPress={() => navigation.navigate('LearnMyLearning')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="library-outline" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <Stack.Screen name="LearnSearchResults" component={LearnSearchResultsScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="LearnVideo" component={LearnVideoScreen} options={{ title: 'Watch' }} />
      <Stack.Screen name="LearnMyLearning" component={LearnMyLearningScreen} options={{ title: 'My Learning' }} />
      <Stack.Screen name="LearnCategory" component={LearnCategoryScreen} options={{ title: 'Category' }} />
    </Stack.Navigator>
  );
}
