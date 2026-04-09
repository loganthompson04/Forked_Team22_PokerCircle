import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
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
  Home: undefined;
  JoinSession: { preFilledCode?: string } | undefined;
  Lobby: { sessionCode: string };
  InviteFriends: { sessionCode: string };
  Game: { sessionCode: string; buyInAmount?: number };
  /** TM22-88 — session summary: net results + who-pays-who settlement */
  Results: { sessionCode: string };
  SessionDetail: { sessionCode: string };
  FriendsList: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

/**
 * Possible outcomes of the startup auth check.
 *   - 'loading'      : check is still in-flight — show spinner
 *   - 'authenticated': valid session found — start on Home
 *   - 'unauthenticated': no session / expired — start on Welcome/Login
 */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  // ---------------------------------------------------------------------------
  // On mount: check whether there is a still-valid session on the server.
  //
  // Strategy:
  //   1. Read local SecureStore — if nothing is there, skip straight to
  //      'unauthenticated' (avoids a network round-trip for first-time users).
  //   2. If we have a stored user, hit GET /api/auth/me with a 5 s timeout.
  //      - 200 OK  → route to Home
  //      - anything else (401, network error, timeout) → route to Welcome
  //
  // The OS-level cookie jar (iOS WKWebView / Android OkHttp) keeps the
  // connect.sid cookie alive across app restarts for the 7-day session window,
  // so the /api/auth/me call will succeed without us having to resend any
  // credentials — we're just using the cookie that was already set on login.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        // Step 1: do we even have a stored user? Skip network call if not.
        const stored = await loadAuth();
        if (!stored) {
          if (!cancelled) setAuthStatus('unauthenticated');
          return;
        }

        // Step 2: validate the session cookie against the server.
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
          // Network error or timeout — treat as unauthenticated so the user
          // can try logging in again (or the app will work once connectivity
          // is restored).
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

  // ---------------------------------------------------------------------------
  // Subtask 3: show a full-screen spinner while the auth check is running so
  // there is no blank-screen flash before routing.
  // ---------------------------------------------------------------------------
  if (authStatus === 'loading') {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName={authStatus === 'authenticated' ? 'Home' : 'Welcome'}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="JoinSession" component={JoinSessionScreen} />
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen
          name="InviteFriends"
          component={InviteFriendsScreen}
          options={{ title: 'Invite Friends' }}
        />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen
          name="Results"
          component={ResultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="FriendsList" component={FriendsListScreen} options={{ title: 'Friends' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});