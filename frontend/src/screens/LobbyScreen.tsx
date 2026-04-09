import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { socket } from '../services/socket';
import { getSession } from '../api/api';
import { colors } from '../theme/colors';
import { BACKEND_URL } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import AvatarDisplay from '../components/AvatarDisplay';

type Props = StackScreenProps<RootStackParamList, 'Lobby'>;

type LobbyPlayer = {
  playerId: string;
  name: string;
  isReady: boolean;
  avatar?: string | null;
};

type LobbyUpdatePayload = {
  sessionCode: string;
  players: LobbyPlayer[];
};

type GameStartPayload = {
  sessionCode: string;
};

export default function LobbyScreen({ route, navigation }: Props) {
  const { sessionCode } = route.params;
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [maxRebuys, setMaxRebuys] = useState(0);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const previousPlayersRef = useRef<LobbyPlayer[]>([]);
  const resolvedPlayerNameRef = useRef('');
  const resolvedAvatarRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const handleLobbyUpdate = (payload: LobbyUpdatePayload) => {
      if (!active) return;
      const previousPlayers = previousPlayersRef.current;
      const currentPlayers = payload.players;

      if (previousPlayers.length === 0 && currentPlayers.length > 0) {
        setJoinMessage(`Joined session ${payload.sessionCode}`);
        setStatusMessage(null);
      } else if (previousPlayers.length < currentPlayers.length) {
        setStatusMessage('A player joined the lobby.');
      } else if (previousPlayers.length > currentPlayers.length) {
        setStatusMessage('A player left the lobby.');
      }

      previousPlayersRef.current = currentPlayers;
      setPlayers(currentPlayers);
      setIsJoining(false);
      setLoading(false);
    };

    const handleGameStart = (payload: GameStartPayload) => {
      if (!active) return;
      navigation.replace('Game', { sessionCode: payload.sessionCode, buyInAmount });
    };

    const handleSocketError = (payload: { message: string }) => {
      if (!active) return;
      setError(payload.message);
      setIsJoining(false);
      setLoading(false);
    };

    const handleConnectError = (_err: unknown) => {
      if (!active) return;
      setError('Could not connect — check your connection');
      setIsJoining(false);
      setLoading(false);
    };

    const handleReconnect = () => {
      if (!active || !resolvedPlayerNameRef.current) return;
      setStatusMessage('Reconnected to lobby.');
      socket.emit('session:joinRoom', {
        sessionCode,
        playerName: resolvedPlayerNameRef.current,
        avatar: resolvedAvatarRef.current,
      });
    };

    const handleConnect = () => {
      if (!active || !resolvedPlayerNameRef.current) return;
      socket.emit('session:joinRoom', {
        sessionCode,
        playerName: resolvedPlayerNameRef.current,
        avatar: resolvedAvatarRef.current,
      });
    };

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const authRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include',
        });

        if (!authRes.ok) {
          if (active) {
            setError('Not authenticated. Please log in again.');
            setLoading(false);
          }
          return;
        }

        const authData = (await authRes.json()) as { userID: string; username: string; avatar?: string | null };
        const myUserId = authData.userID;
        const playerName = authData.username;

        if (!active) return;
        resolvedPlayerNameRef.current = playerName;
        resolvedAvatarRef.current = authData.avatar ?? null;

        try {
          const joinRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ displayName: playerName }),
          });

          if (!joinRes.ok) {
            console.error('Lobby join request failed');
          }
        } catch (err) {
          console.error('Lobby join request error:', err);
        }

        try {
          const session = await getSession(sessionCode);
          if (active) {
            setIsHost(session.hostUserId === myUserId);
            setBuyInAmount(session.buyInAmount ?? 0);
            setMaxRebuys(session.maxRebuys ?? 0);
          }
        } catch (err) {
          console.error('LobbyScreen: Error fetching session:', err);
        }

        socket.on('lobby:update', handleLobbyUpdate);
        socket.on('game:start', handleGameStart);
        socket.on('error', handleSocketError);
        socket.on('reconnect', handleReconnect);
        socket.on('connect', handleConnect);
        socket.on('connect_error', handleConnectError);

        socket.connect();
        if (socket.connected) {
          socket.emit('session:joinRoom', {
            sessionCode,
            playerName: resolvedPlayerNameRef.current,
            avatar: resolvedAvatarRef.current,
          });
        }
      } catch (err) {
        console.error('Lobby init error:', err);
        if (active) {
          setError('Could not connect — check your connection');
          setIsJoining(false);
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      active = false;
      socket.off('lobby:update', handleLobbyUpdate);
      socket.off('game:start', handleGameStart);
      socket.off('error', handleSocketError);
      socket.off('reconnect', handleReconnect);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [sessionCode, navigation]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!startError) return;
    const timer = setTimeout(() => setStartError(null), 4000);
    return () => clearTimeout(timer);
  }, [startError]);

  async function handleReadyToggle() {
    const myPlayerName = resolvedPlayerNameRef.current;
    if (!myPlayerName) return;

    setError(null);
    const myIsReady = players.find((p) => p.name === myPlayerName)?.isReady ?? false;
    const nextReadyState = !myIsReady;

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: myPlayerName,
          isReady: nextReadyState,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? 'Failed to update ready status.');
      }
    } catch (err) {
      console.error('Ready toggle error:', err);
      setError('Could not connect — check your connection');
    }
  }

  const handleStartGame = async () => {
    setIsStarting(true);
    setStartError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionCode}/start`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStartError(data.error ?? 'Failed to start game.');
      }
    } catch (err) {
      console.error('Start game error:', err);
      setStartError('Could not connect — check your connection');
    } finally {
      setIsStarting(false);
    }
  };

  const handleRetry = () => {
    previousPlayersRef.current = [];
    setPlayers([]);
    setError(null);
    setStartError(null);
    setJoinMessage(null);
    setStatusMessage(null);
    setIsJoining(true);
    setLoading(true);

    socket.disconnect();
    socket.connect();
  };

  if (loading) {
    return <LoadingSpinner message="Joining lobby..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContent}>
          <ErrorMessage message={error} onRetry={handleRetry} />
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const allReady = players.length >= 2 && players.every((p) => p.isReady);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sessionCode}>{sessionCode}</Text>
        <Text style={styles.playerCount}>
          {players.length} {players.length === 1 ? 'player' : 'players'}
        </Text>
      </View>

      {(buyInAmount > 0 || maxRebuys > 0) && (
        <View style={styles.rulesCard}>
          {buyInAmount > 0 && (
            <Text style={styles.ruleText}>Buy-in: ${buyInAmount}</Text>
        )}
        <Text style={styles.ruleText}>
          Rebuys: {maxRebuys === 0 ? 'Unlimited' : `Max ${maxRebuys}`}
        </Text>
      </View>
    )}

      {isJoining && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Joining lobby...</Text>
        </View>
      )}

      {joinMessage && !isJoining && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{joinMessage}</Text>
        </View>
      )}

      {statusMessage && !isJoining && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      )}

      {startError && <ErrorMessage message={startError} onRetry={handleStartGame} />}

      <FlatList
        data={players}
        keyExtractor={(item) => item.playerId}
        renderItem={({ item, index }) => {
          const isMe = item.name === resolvedPlayerNameRef.current;

          return (
            <View style={styles.playerRow}>
              <View style={styles.playerLeft}>
                <AvatarDisplay avatarId={item.avatar} size={36} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <Text style={styles.playerLabel}>Player {index + 1}</Text>
                </View>
              </View>

              {isMe ? (
                <Pressable
                  onPress={handleReadyToggle}
                  style={[styles.readyButton, item.isReady && styles.readyButtonActive]}
                >
                  <Text
                    style={[
                      styles.readyButtonText,
                      item.isReady && styles.readyButtonTextActive,
                    ]}
                  >
                    {item.isReady ? 'Not Ready' : 'Ready'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={item.isReady ? styles.readyBadge : styles.notReadyBadge}>
                  {item.isReady ? 'Ready' : 'Not Ready'}
                </Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Lobby is empty</Text>
            <Text style={styles.emptyText}>Waiting for players to join...</Text>
          </View>
        }
      />

      {isHost && (
        <View style={styles.startButtonContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.inviteButton,
              pressed && styles.inviteButtonPressed,
            ]}
            onPress={() => navigation.navigate('InviteFriends', { sessionCode })}
          >
            <Text style={styles.inviteButtonText}>Invite Friends</Text>
          </Pressable>

          {!allReady && (
            <Text style={styles.waitingText}>
              {players.length < 2
                ? 'Waiting for at least 2 players...'
                : 'Waiting for all players to ready up...'}
            </Text>
          )}

          <Pressable
            style={[
              styles.startButton,
              (!allReady || isStarting) && styles.startButtonDisabled,
            ]}
            onPress={handleStartGame}
            disabled={!allReady || isStarting}
          >
            <Text style={styles.startButtonText}>
              {isStarting ? 'Starting...' : 'Start Game'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  sessionCode: { fontSize: 48, fontWeight: 'bold', color: colors.primary, letterSpacing: 8 },
  playerCount: { fontSize: 16, color: colors.text, marginTop: 8 },
  infoBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  infoText: { color: colors.text, fontSize: 14, textAlign: 'center' },
  successBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  successText: { color: colors.primary, fontSize: 14, textAlign: 'center', fontWeight: '600' },
  statusBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  statusText: { color: colors.text, fontSize: 14, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, flexGrow: 1 },
  playerRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: { fontSize: 16, color: colors.text, fontWeight: '600' },
  playerLabel: { marginTop: 4, fontSize: 12, color: colors.placeholder },
  readyBadge: { fontSize: 12, fontWeight: '600', color: colors.primary },
  notReadyBadge: { fontSize: 12, fontWeight: '600', color: colors.placeholder },
  readyButton: {
    borderWidth: 1,
    borderColor: colors.placeholder,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  readyButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  readyButtonText: { fontSize: 12, fontWeight: '600', color: colors.placeholder },
  readyButtonTextActive: { color: colors.textOnPrimary },
  emptyState: { marginTop: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.placeholder, fontSize: 16 },
  errorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  startButtonContainer: { padding: 16, paddingBottom: 24 },
  waitingText: {
    textAlign: 'center',
    color: colors.placeholder,
    fontSize: 13,
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonDisabled: { opacity: 0.4 },
  startButtonText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
  inviteButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteButtonPressed: { opacity: 0.85 },
  inviteButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  playerLeft: { flexDirection: 'row', alignItems: 'center' },
  playerInfo: { marginLeft: 10 },
  rulesCard: {
  marginHorizontal: 16,
  marginBottom: 12,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 8,
  backgroundColor: colors.inputBackground,
  borderWidth: 1,
  borderColor: colors.inputBorder,
  alignItems: 'center',
},
ruleText: {
  color: colors.text,
  fontSize: 14,
  fontWeight: '600',
  marginVertical: 2,
},
});
