import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { BACKEND_URL } from '../config/api';

type Props = StackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'main' | 'demo1' | 'demo2' | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (loading) return;

    setLoading('main');
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        navigation.replace('Home');
      } else {
        Alert.alert('Error', data.error || 'Login failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleDemoLogin = async (key: 'demo1' | 'demo2', demoEmail: string, demoPassword: string) => {
    if (loading) return;

    setLoading(key);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        navigation.replace('Home');
      } else {
        Alert.alert('Error', data.error ?? data.message ?? 'Demo login failed. Run npm run seed first.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.placeholder}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleLogin}
        disabled={loading !== null}
      >
        {loading === 'main' ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </Pressable>

      <View style={styles.demoSection}>
        <Text style={styles.demoLabel}>Quick Login (Testing)</Text>
        <Pressable
          style={({ pressed }) => [styles.demoButton, pressed && styles.buttonPressed]}
          onPress={() => handleDemoLogin('demo1', 'demo1@pokercircle.dev', '000000')}
          disabled={loading !== null}
        >
          {loading === 'demo1' ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.demoButtonText}>Login as Demo 1</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.demoButton, pressed && styles.buttonPressed]}
          onPress={() => handleDemoLogin('demo2', 'demo2@pokercircle.dev', '000000')}
          disabled={loading !== null}
        >
          {loading === 'demo2' ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.demoButtonText}>Login as Demo 2</Text>
          )}
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate('Signup')} style={styles.link}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  demoSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder,
    paddingTop: 16,
    gap: 10,
  },
  demoLabel: {
    color: colors.placeholder,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  demoButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
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
