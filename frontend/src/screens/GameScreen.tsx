import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { completeSession, getSession, updatePlayerFinances } from '../api/api';
import { socket } from '../services/socket';
import { BACKEND_URL } from '../config/api';
import type { Player } from '../types/session';
import LoadingSpinner from '../components/LoadingSpinner';
import AvatarDisplay from '../components/AvatarDisplay';

type Props = StackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ route, navigation }: Props) {
  const { sessionCode } = route.params;

  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);

  // Financial inputs for the current player
  const [buyIn, setBuyIn] = useState('');
  const [rebuy, setRebuy] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [isUpdatingFinances, setIsUpdatingFinances] = useState(false);

  // -------------------------------------------------------------------------
  // Initialization: Auth, Session, and Socket
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const [authRes, sessionRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auth/me`, { credentials: 'include' }),
          getSession(sessionCode),
        ]);

        if (!authRes.ok) {
          if (active) navigation.navigate('Login');
          return;
        }

        const auth = await authRes.json() as { userID: string; username: string };
        
        if (active) {
          setMyPlayerName(auth.username);
          setIsHost(auth.userID === sessionRes.hostUserId);
          setPlayers(sessionRes.players);
          
          // Pre-fill my own finances if they exist
          const me = sessionRes.players.find(p => p.displayName === auth.username);
          if (me) {
            setBuyIn(me.buyIn.toString());
            setRebuy(me.rebuyTotal.toString());
            setCashOut(me.cashOut > 0 ? me.cashOut.toString() : '');
          }
          
          setLoading(false);
        }

        // Socket setup
        socket.connect();
        socket.emit('session:joinRoom', {
          sessionCode,
          playerName: auth.username,
        });
      } catch (err) {
        console.error('GameScreen init error:', err);
        if (active) setLoading(false);
      }
    }

    void init();

    const handleFinanceUpdate = (payload: { sessionCode: string; players: Player[] }) => {
      if (active && payload.sessionCode === sessionCode) {
        setPlayers(payload.players);
      }
    };

    const handleComplete = (payload: { sessionCode: string }) => {
      if (active) navigation.replace('Results', { sessionCode: payload.sessionCode });
    };

    socket.on('finance:update', handleFinanceUpdate);
    socket.on('game:complete', handleComplete);

    return () => {
      active = false;
      socket.off('finance:update', handleFinanceUpdate);
      socket.off('game:complete', handleComplete);
    };
  }, [sessionCode, navigation]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async function handleUpdateFinances() {
    if (!myPlayerName) return;
    
    setIsUpdatingFinances(true);
    try {
      await updatePlayerFinances(sessionCode, myPlayerName, {
        buyIn: buyIn ? parseFloat(buyIn) : 0,
        rebuyTotal: rebuy ? parseFloat(rebuy) : 0,
        cashOut: cashOut ? parseFloat(cashOut) : 0,
      });
      // The local state will be updated via the socket event 'finance:update'
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update finances');
    } finally {
      setIsUpdatingFinances(false);
    }
  }

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

  if (loading) return <LoadingSpinner message="Loading game..." />;

  const renderPlayer = ({ item }: { item: Player }) => {
    const isMe = item.displayName === myPlayerName;
    const hasCashedOut = item.cashOut > 0;

    return (
      <View style={[styles.playerCard, isMe && styles.myPlayerCard]}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameRow}>
            <AvatarDisplay avatarId={item.avatar} size={36} />
            <Text style={[styles.playerName, { marginLeft: 10 }]}>{item.displayName} {isMe && '(You)'}</Text>
          </View>
          {hasCashedOut ? (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedText}>CASHED OUT</Text>
            </View>
          ) : (
            <Text style={styles.activeText}>In Play</Text>
          )}
        </View>
        <View style={styles.playerStats}>
          <Text style={styles.statText}>Total In: ${item.buyIn + item.rebuyTotal}</Text>
          {hasCashedOut && <Text style={styles.statText}>Out: ${item.cashOut}</Text>}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <View style={styles.codeBadge}>
            <Text style={styles.codeLabel}>SESSION</Text>
            <Text style={styles.code}>{sessionCode}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Players Status</Text>
          <FlatList
            data={players}
            renderItem={renderPlayer}
            keyExtractor={(p) => p.playerId || p.displayName || Math.random().toString()}
            contentContainerStyle={styles.playerList}
          />

          <View style={styles.myActions}>
            <Text style={styles.sectionTitle}>Your Finances</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Buy-in</Text>
                <TextInput
                  style={styles.input}
                  value={buyIn}
                  onChangeText={setBuyIn}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rebuys</Text>
                <TextInput
                  style={styles.input}
                  value={rebuy}
                  onChangeText={setRebuy}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cash-out</Text>
                <TextInput
                  style={styles.input}
                  value={cashOut}
                  onChangeText={setCashOut}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>
            <Pressable
              style={[styles.updateButton, isUpdatingFinances && styles.buttonDisabled]}
              onPress={handleUpdateFinances}
              disabled={isUpdatingFinances}
            >
              {isUpdatingFinances ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.updateButtonText}>Confirm My Totals</Text>
              )}
            </Pressable>
          </View>

          {isHost && (
            <Pressable
              style={[styles.endButton, isEnding && styles.buttonDisabled]}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingVertical: 10 },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 10 },
  playerList: { paddingBottom: 20 },
  playerCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  myPlayerCard: { borderColor: colors.primary, borderWidth: 1.5 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center' },
  playerName: { fontSize: 16, fontWeight: '600', color: colors.text },
  activeText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  confirmedBadge: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  confirmedText: { fontSize: 10, color: colors.textOnPrimary, fontWeight: '800' },
  playerStats: { flexDirection: 'row', gap: 15 },
  statText: { fontSize: 14, color: colors.placeholder },
  
  myActions: {
    backgroundColor: colors.inputBackground,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginBottom: 20,
  },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 12, color: colors.placeholder, marginBottom: 5 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: 16,
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  updateButtonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
  
  endButton: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  endButtonText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },

  codeBadge: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  codeLabel: { fontSize: 10, color: colors.placeholder, letterSpacing: 2, marginBottom: 2 },
  code: { fontSize: 20, fontWeight: '800', color: colors.primary, letterSpacing: 4 },
});
