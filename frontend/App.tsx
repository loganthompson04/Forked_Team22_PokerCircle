import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import JoinSessionScreen from './src/screens/JoinSessionScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import GameScreen from './src/screens/GameScreen';
import InviteFriendsScreen from './src/screens/InviteFriendsScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import FriendsListScreen from './src/screens/FriendsListScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SessionDetailScreen from './src/screens/SessionDetailScreen';

import { BACKEND_URL } from './src/config/api';
import { loadAuth } from './src/services/authStorage';
import { colors } from './src/theme/colors';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  MainTabs: undefined;
  JoinSession: { preFilledCode?: string } | undefined;
  Lobby: { sessionCode: string };
  InviteFriends: { sessionCode: string };
  Game: { sessionCode: string; buyInAmount?: number };
  Results: { sessionCode: string };
  SessionDetail: { sessionCode: string };
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

/* ---------------- TAB NAVIGATOR ---------------- */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: any;

          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'FriendsList') iconName = 'people';
          else if (route.name === 'Profile') iconName = 'person';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="FriendsList" component={FriendsListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/* ---------------- AUTH STATE ---------------- */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const stored = await loadAuth();
        if (!stored) {
          if (!cancelled) setAuthStatus('unauthenticated');
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
            credentials: 'include',
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!cancelled) {
            setAuthStatus(res.ok ? 'authenticated' : 'unauthenticated');
          }
        } catch {
          clearTimeout(timeout);
          if (!cancelled) setAuthStatus('unauthenticated');
        }
      } catch {
        if (!cancelled) setAuthStatus('unauthenticated');
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------- LOADING SCREEN ---------------- */
  if (authStatus === 'loading') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /* ---------------- NAVIGATION ---------------- */
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName={authStatus === 'authenticated' ? 'MainTabs' : 'Welcome'}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTintColor: colors.primary,
          headerTitle: '',
          headerBackTitleVisible: false,
        }}
      >
        {/* AUTH */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />

        {/* MAIN APP (WITH TABS) */}
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />

        {/* SESSION SCREENS (NO TAB BAR) */}
        <Stack.Screen name="JoinSession" component={JoinSessionScreen} />
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen name="InviteFriends" component={InviteFriendsScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
