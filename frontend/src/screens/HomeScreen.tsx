import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { createSession, getPendingInvites, respondToInvite, getPendingFriendRequests, respondToFriendRequest } from '../api/api';
import { socket } from '../services/socket';
import { BACKEND_URL } from '../config/api';
import type { FriendRequest, SessionInvite } from '../types/invite';

type Props = StackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [invites, setInvites] = useState<SessionInvite[]>([]);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [respondingToRequest, setRespondingToRequest] = useState<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleUserConnect = () => {
      if (userIdRef.current) {
        socket.emit('user:joinRoom', userIdRef.current);
      }
    };
    socket.on('connect', handleUserConnect);

    // Fetch current user and join personal socket room
    fetch(`${BACKEND_URL}/api/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ userID: string; username: string }>;
      })
      .then((data) => {
        if (data) {
          userIdRef.current = data.userID;
          socket.connect();
          if (socket.connected) {
            socket.emit('user:joinRoom', data.userID);
          }
        }
      })
      .catch(() => {});

    // Real-time: prepend new invites as they arrive
    const handleNewInvite = (invite: SessionInvite) => {
      setInvites((prev) => {
        if (prev.some((i) => i.id === invite.id)) return prev;
        return [invite, ...prev];
      });
    };
    socket.on('user:invite', handleNewInvite);

    return () => {
      socket.off('connect', handleUserConnect);
      socket.off('user:invite', handleNewInvite);
    };
  }, []);

  // Load on mount and whenever the screen comes back into focus
  useEffect(() => {
    loadInvites();
    loadFriendRequests();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadInvites();
      loadFriendRequests();
    });
    return unsubscribe;
  }, [navigation]);

  async function loadInvites() {
    try {
      const pending = await getPendingInvites();
      setInvites(pending);
    } catch {
      // silently fail — invites are non-critical
    }
  }

  async function loadFriendRequests() {
    try {
      const requests = await getPendingFriendRequests();
      setFriendRequests(requests);
    } catch {
      // silently fail
    }
  }

  async function handleRespondToRequest(request: FriendRequest, action: 'accept' | 'decline') {
    setRespondingToRequest(request.id);
    try {
      await respondToFriendRequest(request.id, action);
      setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch {
      // silently fail
    } finally {
      setRespondingToRequest(null);
    }
  }

  async function handleCreateSession() {
    setCreateError(null);
    setCreating(true);
    try {
      const session = await createSession();
      navigation.navigate('Lobby', { sessionCode: session.sessionCode });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  async function handleRespond(invite: SessionInvite, action: 'accept' | 'decline') {
    setRespondingTo(invite.id);
    setRespondError(null);
    try {
      await respondToInvite(invite.id, action);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (action === 'accept') {
        navigation.navigate('JoinSession', { preFilledCode: invite.sessionCode });
      }
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410) {
        setRespondError('That session has already started.');
        setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      } else {
        setRespondError(err instanceof Error ? err.message : 'Could not respond to invite.');
      }
    } finally {
      setRespondingTo(null);
    }
  }

  const headerContent = (
    <View style={styles.header}>
      <Text style={styles.title}>PokerCircle</Text>

      {friendRequests.length > 0 && (
        <View style={styles.inviteSection}>
          <Text style={styles.inviteSectionTitle}>Friend Requests</Text>
          {friendRequests.map((request) => {
            const isResponding = respondingToRequest === request.id;
            return (
              <View key={request.id} style={styles.inviteRow}>
                <Text style={styles.inviteFrom}>{request.requesterUsername}</Text>
                <View style={styles.inviteActions}>
                  <Pressable
                    style={[styles.acceptButton, isResponding && styles.actionDisabled]}
                    onPress={() => handleRespondToRequest(request, 'accept')}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <ActivityIndicator color={colors.textOnPrimary} size="small" />
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.declineButton, isResponding && styles.actionDisabled]}
                    onPress={() => handleRespondToRequest(request, 'decline')}
                    disabled={isResponding}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {invites.length > 0 && (
        <View style={styles.inviteSection}>
          <Text style={styles.inviteSectionTitle}>Session Invites</Text>
          {respondError !== null && (
            <Text style={styles.respondError}>{respondError}</Text>
          )}
        </View>
      )}
    </View>
  );

  const footerContent = (
    <View style={styles.buttonContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || creating) && styles.buttonPressed,
        ]}
        onPress={handleCreateSession}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Create Session</Text>
        )}
      </Pressable>

      {createError !== null && (
        <Text style={styles.errorText}>{createError}</Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => navigation.navigate('JoinSession')}
      >
        <Text style={styles.secondaryButtonText}>Join Session</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => navigation.navigate('FindFriends')}
      >
        <Text style={styles.secondaryButtonText}>Find Friends</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={invites}
      keyExtractor={(item) => item.id.toString()}
      ListHeaderComponent={headerContent}
      ListFooterComponent={footerContent}
      renderItem={({ item }) => {
        const isResponding = respondingTo === item.id;
        return (
          <View style={styles.inviteRow}>
            <Text style={styles.inviteFrom}>From: {item.inviterUsername}</Text>
            <Text style={styles.inviteCode}>{item.sessionCode}</Text>
            <View style={styles.inviteActions}>
              <Pressable
                style={[styles.acceptButton, isResponding && styles.actionDisabled]}
                onPress={() => handleRespond(item, 'accept')}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator color={colors.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.declineButton, isResponding && styles.actionDisabled]}
                onPress={() => handleRespond(item, 'decline')}
                disabled={isResponding}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 8,
  },
  title: {
    fontSize: 42,
    letterSpacing: 3,
    marginBottom: 40,
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  inviteSection: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 8,
  },
  inviteSectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inviteRow: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 12,
    marginBottom: 8,
  },
  inviteFrom: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 4,
  },
  inviteCode: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 10,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.disabled,
  },
  acceptButtonText: {
    color: colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  declineButtonText: {
    color: colors.placeholder,
    fontSize: 13,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  respondError: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    paddingTop: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: 14,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  errorText: {
    color: colors.primary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
  },
});
