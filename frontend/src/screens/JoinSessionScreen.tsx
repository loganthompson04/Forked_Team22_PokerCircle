import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';

type Props = StackScreenProps<RootStackParamList, 'JoinSession'>;

export default function JoinSessionScreen({ navigation, route }: Props) {
  const preFilledCode = route.params?.preFilledCode ?? '';
  const [sessionCode, setSessionCode] = useState(preFilledCode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = sessionCode.length === 6;

  function handleChangeText(text: string) {
    setSessionCode(text.replace(/\s/g, '').toUpperCase());
  }

  function handleJoin() {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    navigation.navigate('Lobby', { sessionCode });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Join Session</Text>

        <Text style={styles.label}>Enter 6-character session code</Text>

        <TextInput
          style={styles.input}
          value={sessionCode}
          onChangeText={handleChangeText}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXXXX"
          placeholderTextColor={colors.placeholder}
        />

        {sessionCode.length > 0 && sessionCode.length < 6 && (
          <Text style={styles.helperText}>Session code must be 6 characters.</Text>
        )}

        <Pressable
          style={[styles.button, (!isValid || isSubmitting) && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={!isValid || isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Joining...' : 'Join Game'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primaryDark,
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
    marginBottom: 24,
  },
  helperText: {
    width: '100%',
    color: colors.placeholder,
    fontSize: 14,
    marginTop: -12,
    marginBottom: 20,
    textAlign: 'left',
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
});
