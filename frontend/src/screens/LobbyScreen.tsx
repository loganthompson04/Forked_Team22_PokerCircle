import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import type { Player } from '../types/session';
import { socket } from '../services/socket';
import { colors } from '../theme/colors';

type Props = StackScreenProps<RootStackParamList, 'Lobby'>;

type LobbyUpdatePayload = {
  sessionCode: string;
  players: Player[];
};

const BACKEND_URL = 'http://localhost:3000';

export default function LobbyScreen({ route, navigation }: Props) {
  const { sessionCode, devPlayerName } = route.params;
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const previousPlayersRef = useRef<Player[]>([]);

  useEffect(() => {
    let active = true;
    let resolvedPlayerName = '';

    const handleLobbyUpdate = (payload: LobbyUpdatePayload) => {
      if (!active) return;

      console.log('Received lobby:update', payload);

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
    };

    const handleSocketError = (payload: { message: string }) => {
      if (!active) return;
      console.log('Socket error received', payload);
      setError(payload.message);
      setIsJoining(false);
    };

    const handleConnectError = (err: any) => {
      if (!active) return;
      console.log('Socket connect_error in LobbyScreen', err?.message);
      setError('Could not connect to lobby server.');
      setIsJoining(false);
    };

    const handleReconnect = () => {
      if (!active || !resolvedPlayerName) return;

      console.log('Reconnected — rejoining session');
      setStatusMessage('Reconnected to lobby.');

      socket.emit('session:joinRoom', {
        sessionCode,
        playerName: resolvedPlayerName,
      });
    };

    const handleConnect = () => {
      if (!active || !resolvedPlayerName) return;

      console.log('Socket connected in LobbyScreen, joining room', {
        sessionCode,
        playerName: resolvedPlayerName,
      });

      socket.emit('session:joinRoom', {
        sessionCode,
        playerName: resolvedPlayerName,
      });
    };

    async function init() {
      try {
        if (devPlayerName !== undefined) {
          resolvedPlayerName = devPlayerName;
        } else {
          const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
            credentials: 'include',
          });

          if (!res.ok) {
            if (active) {
              setError('Not authenticated. Please log in again.');
              setIsJoining(false);
            }
            return;
          }

          const data = (await res.json()) as { username: string };
          if (!active) return;
          resolvedPlayerName = data.username;
        }

        socket.on('lobby:update', handleLobbyUpdate);
        socket.on('error', handleSocketError);
        socket.on('reconnect', handleReconnect);
        socket.on('connect', handleConnect);
        socket.on('connect_error', handleConnectError);

        console.log('About to connect socket');
        socket.connect();
      } catch (err) {
        console.error('Lobby init error', err);
        if (active) {
          setError('Could not connect to server.');
          setIsJoining(false);
        }
      }
    }

    init();

    return () => {
      active = false;
      socket.off('lobby:update', handleLobbyUpdate);
      socket.off('error', handleSocketError);
      socket.off('reconnect', handleReconnect);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [sessionCode, devPlayerName]);

  useEffect(() => {
    if (!statusMessage) return;

    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [statusMessage]);

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sessionCode}>{sessionCode}</Text>
        <Text style={styles.playerCount}>
          {players.length} {players.length === 1 ? 'player' : 'players'}
        </Text>
      </View>

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

      <FlatList
        data={players}
        keyExtractor={(item) => item.playerId}
        renderItem={({ item, index }) => (
          <View style={styles.playerRow}>
            <View>
              <Text style={styles.playerName}>{item.name}</Text>
              <Text style={styles.playerLabel}>Player {index + 1}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Lobby is empty</Text>
            <Text style={styles.emptyText}>Waiting for players to join...</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  sessionCode: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 8,
  },
  playerCount: {
    fontSize: 16,
    color: colors.text,
    marginTop: 8,
  },
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
  infoText: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
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
  successText: {
    color: colors.primary,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
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
  statusText: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  playerRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  playerName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  playerLabel: {
    marginTop: 4,
    fontSize: 12,
    color: colors.placeholder,
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.placeholder,
    fontSize: 16,
  },
  errorContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: colors.primary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});