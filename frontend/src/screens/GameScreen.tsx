import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { completeSession } from '../api/api';
import { socket } from '../services/socket';
import { BACKEND_URL } from '../config/api';

type Props = StackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ route, navigation }: Props) {
  const { sessionCode } = route.params;

  const [isHost, setIsHost] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // -------------------------------------------------------------------------
  // Determine if the current user is the host
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    async function checkHost() {
      try {
        const [authRes, sessionRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auth/me`, { credentials: 'include' }),
          fetch(`${BACKEND_URL}/api/sessions/${sessionCode}`, { credentials: 'include' }),
        ]);
        if (!authRes.ok || !sessionRes.ok) return;

        const auth = await authRes.json() as { userID: string };
        const session = await sessionRes.json() as { hostUserId: string };

        if (active) {
          setIsHost(auth.userID === session.hostUserId);
        }
      } catch {
        // non-critical — UI just won't show the end button
      }
    }

    void checkHost();
    return () => { active = false; };
  }, [sessionCode]);

  // -------------------------------------------------------------------------
  // Socket: all clients navigate to Results when host fires game:complete
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleComplete = (payload: { sessionCode: string }) => {
      navigation.replace('Results', { sessionCode: payload.sessionCode });
    };

    socket.on('game:complete', handleComplete);
    return () => {
      socket.off('game:complete', handleComplete);
    };
  }, [navigation]);

  // -------------------------------------------------------------------------
  // Host action: end session
  // -------------------------------------------------------------------------
  async function handleEndSession() {
    Alert.alert(
      'End Session',
      'This will finalise all results and show the settlement screen to everyone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            setIsEnding(true);
            try {
              await completeSession(sessionCode);
              // Navigation is driven by the game:complete socket event received above
            } catch (err: unknown) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Could not end the session'
              );
              setIsEnding(false);
            }
          },
        },
      ]
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Session code badge */}
        <View style={styles.codeBadge}>
          <Text style={styles.codeLabel}>SESSION</Text>
          <Text style={styles.code}>{sessionCode}</Text>
        </View>

        <Text style={styles.title}>Game in Progress</Text>
        <Text style={styles.subtitle}>
          Track buy-ins and cash-outs, then end the session to see who owes who.
        </Text>

        {/* Placeholder for future active game UI */}
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>🃏  Poker game UI coming soon…</Text>
        </View>

        {/* Host-only: End Session */}
        {isHost && (
          <Pressable
            style={({ pressed }) => [
              styles.endButton,
              (pressed || isEnding) && styles.endButtonPressed,
            ]}
            onPress={handleEndSession}
            disabled={isEnding}
          >
            {isEnding ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.endButtonText}>End Session &amp; See Results</Text>
            )}
          </Pressable>
        )}

        {!isHost && (
          <Text style={styles.waitingText}>
            Waiting for the host to end the session…
          </Text>
        )}
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
    gap: 20,
  },

  codeBadge: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  codeLabel: {
    fontSize: 10,
    color: colors.placeholder,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 6,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 22,
  },

  placeholderBox: {
    backgroundColor: colors.inputBackground,
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    width: '100%',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.placeholder,
    fontSize: 16,
  },

  endButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  endButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  endButtonText: {
    color: colors.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  waitingText: {
    color: colors.placeholder,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
