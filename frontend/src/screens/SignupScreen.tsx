import React, { useState } from 'react';
import {
  StyleSheet, Text, TextInput, Pressable,
  ActivityIndicator, ScrollView, StatusBar,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { BACKEND_URL } from '../config/api';
import { saveAuth } from '../services/authStorage';

type Props = StackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = () => setErrorMessage(null);

  const handleSignup = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json() as {
        userID?: string;
        username?: string;
        email?: string;
        error?: string;
        message?: string;
      };

      if (response.ok && data.userID && data.username && data.email) {
        await saveAuth({
          userID: data.userID,
          username: data.username,
          email: data.email,
        });
        navigation.replace('MainTabs');
      } else if (response.status === 409) {
        setErrorMessage(data.error ?? 'That email or username is already taken.');
      } else {
        setErrorMessage(data.error ?? data.message ?? 'Sign up failed. Please try again.');
      }
    } catch {
      setErrorMessage('Could not connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor={colors.placeholder}
        value={username}
        onChangeText={(t) => { setUsername(t); clearError(); }}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.placeholder}
        value={email}
        onChangeText={(t) => { setEmail(t); clearError(); }}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.placeholder}
        value={password}
        onChangeText={(t) => { setPassword(t); clearError(); }}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor={colors.placeholder}
        value={confirmPassword}
        onChangeText={(t) => { setConfirmPassword(t); clearError(); }}
        secureTextEntry
      />

      {errorMessage !== null && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Login')} style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    color: colors.primaryDark,
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.text,
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  errorText: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontSize: 16,
  },
});
