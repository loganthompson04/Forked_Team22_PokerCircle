import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import JoinSessionScreen from './src/screens/JoinSessionScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import FindFriendsScreen from './src/screens/FindFriendsScreen';
import GameScreen from './src/screens/GameScreen';
import InviteFriendsScreen from './src/screens/InviteFriendsScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  JoinSession: { preFilledCode?: string } | undefined;
  Lobby: { sessionCode: string };
  FindFriends: undefined;
  InviteFriends: { sessionCode: string };
  Game: { sessionCode: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Welcome">
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="JoinSession" component={JoinSessionScreen} />
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        <Stack.Screen name="FindFriends" component={FindFriendsScreen} />
        <Stack.Screen name="InviteFriends" component={InviteFriendsScreen} options={{ title: 'Invite Friends' }} />
        <Stack.Screen name="Game" component={GameScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
