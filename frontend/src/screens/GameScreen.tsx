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
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [maxRebuys, setMaxRebuys] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [buyIn, setBuyIn] = useState('');
  const [rebuy, setRebuy] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [isUpdatingFinances, setIsUpdatingFinances] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);

  // Use a ref so socket event handlers always see the latest player name
  const myPlayerNameRef = useRef<string | null>(null);
  const sessionCodeRef = useRef(sessionCode);

  useEffect(() => {
    let active = true;

    const handleConnect = () => {
      if (myPlayerNameRef.current) {
        socket.emit('session:joinRoom', {
          sessionCode: sessionCodeRef.current,
          playerName: myPlayerNameRef.current,
        });
      }
    };

    const handleFinanceUpdate = (payload: { sessionCode: string; players: Player[] }) => {
      if (active && payload.sessionCode === sessionCodeRef.current) {
        setPlayers(payload.players);
      }
    };

    const handleComplete = (payload: { sessionCode: string }) => {
      if (active) {
        navigation.replace('Results', { sessionCode: payload.sessionCode });
      }
    };

    // Attach handlers BEFORE connecting
    socket.on('connect', handleConnect);
    socket.on('finance:update', handleFinanceUpdate);
    socket.on('game:complete', handleComplete);

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

        myPlayerNameRef.current = auth.username;

        if (active) {
          setMyPlayerName(auth.username);
          setIsHost(auth.userID === sessionRes.hostUserId);
          setPlayers(sessionRes.players);
          setBuyInAmount(sessionRes.buyInAmount ?? 0);
          setMaxRebuys(sessionRes.maxRebuys ?? 0);

          // Pre-fill my finances from existing session data
          const me = sessionRes.players.find(
            (p) => (p.displayName ?? p.name) === auth.username
          );
          if (me) {
            if (me.buyIn > 0) {
              setBuyIn(me.buyIn.toString());
            } else if (sessionRes.buyInAmount > 0) {
              setBuyIn(sessionRes.buyInAmount.toString());
            }
            if (me.rebuyTotal > 0) setRebuy(me.rebuyTotal.toString());
            if (me.cashOut > 0) setCashOut(me.cashOut.toString());
          } else if (sessionRes.buyInAmount > 0) {
            setBuyIn(sessionRes.buyInAmount.toString());
          }

          setLoading(false);
        }

        if (socket.connected) {
          handleConnect();
        } else {
          socket.connect();
        }
      } catch (err) {
        console.error('GameScreen init error:', err);
        if (active) setLoading(false);
      }
    }

    void init();

    return () => {
      active = false;
      socket.off('connect', handleConnect);
      socket.off('finance:update', handleFinanceUpdate);
      socket.off('game:complete', handleComplete);
    };
  }, [sessionCode, navigation]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async function handleUpdateFinances() {
    if (!myPlayerNameRef.current) return;

    setFinanceError(null);

    const buyInVal = buyIn ? parseFloat(buyIn) : 0;
    const rebuyVal = rebuy ? parseFloat(rebuy) : 0;
    const cashOutVal = cashOut ? parseFloat(cashOut) : 0;

    if (maxRebuys > 0 && buyInAmount > 0 && rebuyVal > 0) {
      const impliedCount = Math.round(rebuyVal / buyInAmount);
      if (impliedCount > maxRebuys) {
        setFinanceError(`Max rebuys is ${maxRebuys}. You cannot exceed that limit.`);
        return;
      }
    }

    setIsUpdatingFinances(true);
    try {
      await updatePlayerFinances(sessionCode, myPlayerNameRef.current, {
        buyIn: buyInVal,
        rebuyTotal: rebuyVal,
        cashOut: cashOutVal,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      // Player list will update via 'finance:update' socket event
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update finances';
      setFinanceError(msg);
    } finally {
      setIsUpdatingFinances(false);
    }
  }

  async function handleEndSession() {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('This will finalise all results and show the settlement screen to everyone. Are you sure?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'End Session',
            'This will finalise all results and show the settlement screen to everyone. Are you sure?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'End Session', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
  
    if (!confirmed) return;
  
    setIsEnding(true);
    try {
      await completeSession(sessionCode);
      setTimeout(() => {
        navigation.replace('Results', { sessionCode });
      }, 3000);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not end the session');
      setIsEnding(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading game..." />;

  const renderPlayer = ({ item }: { item: Player }) => {
    const displayName = item.displayName ?? item.name ?? '';
    const isMe = displayName === myPlayerName;
    const hasCashedOut = item.cashOut > 0;
    const totalIn = item.buyIn + item.rebuyTotal;

    return (
      <View style={[styles.playerCard, isMe && styles.myPlayerCard]}>
        <View style={styles.playerHeader}>
          <View style={styles.playerNameRow}>
            <AvatarDisplay avatarId={item.avatar} size={36} />
            <Text style={[styles.playerName, { marginLeft: 10 }]}>
              {displayName} {isMe && '(You)'}
            </Text>
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
          {totalIn > 0 && (
            <Text style={styles.statText}>
              Total In: <Text style={styles.statAmount}>${totalIn}</Text>
            </Text>
          )}
          {item.rebuyTotal > 0 && (
            <Text style={styles.statText}>
              Rebuys: <Text style={styles.statAmount}>${item.rebuyTotal}</Text>
            </Text>
          )}
          {hasCashedOut && (
            <Text style={styles.statText}>
              Cash-out: <Text style={styles.statAmount}>${item.cashOut}</Text>
            </Text>
          )}
          {hasCashedOut && totalIn > 0 && (
            <Text style={[
              styles.statText,
              item.cashOut - totalIn >= 0 ? styles.positive : styles.negative
            ]}>
              Net: {item.cashOut - totalIn >= 0 ? '+' : ''}${item.cashOut - totalIn}
            </Text>
          )}
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

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Players ({players.length})</Text>
          <FlatList
            data={players}
            renderItem={renderPlayer}
            keyExtractor={(p) =>
              p.playerId || (p.displayName ?? p.name) || Math.random().toString()
            }
            contentContainerStyle={styles.playerList}
            scrollEnabled={false}
          />

          <View style={styles.myActions}>
            <Text style={styles.sectionTitle}>Your Finances</Text>
            <Text style={styles.financeHint}>
              Enter your totals and tap "Confirm" — you can update any time.
            </Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Buy-in ($)</Text>
                <TextInput
                  style={styles.input}
                  value={buyIn}
                  onChangeText={(v) => { setBuyIn(v); setFinanceError(null); }}
                  keyboardType="numeric"
                  placeholder={buyInAmount > 0 ? String(buyInAmount) : '0'}
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rebuys ($)</Text>
                <TextInput
                  style={styles.input}
                  value={rebuy}
                  onChangeText={(v) => { setRebuy(v); setFinanceError(null); }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cash-out ($)</Text>
                <TextInput
                  style={styles.input}
                  value={cashOut}
                  onChangeText={(v) => { setCashOut(v); setFinanceError(null); }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            {financeError && (
              <Text style={styles.errorText}>{financeError}</Text>
            )}

            <Pressable
              style={[
                styles.updateButton,
                isUpdatingFinances && styles.buttonDisabled,
                saveSuccess && styles.updateButtonSuccess,
              ]}
              onPress={handleUpdateFinances}
              disabled={isUpdatingFinances}
            >
              {isUpdatingFinances ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text style={styles.updateButtonText}>
                  {saveSuccess ? '✓ Saved!' : 'Confirm My Totals'}
                </Text>
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
                <Text style={styles.endButtonText}>
                  End Session &amp; See Results
                </Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 10,
  },
  financeHint: {
    fontSize: 12,
    color: colors.placeholder,
    marginBottom: 12,
  },
  playerList: { paddingBottom: 8 },
  playerCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  myPlayerCard: { borderColor: colors.primary, borderWidth: 1.5 },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  playerName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  activeText: { fontSize: 11, color: colors.placeholder, fontWeight: '600' },
  confirmedBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  confirmedText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  playerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statText: { fontSize: 13, color: colors.placeholder },
  statAmount: { color: colors.text, fontWeight: '600' },
  positive: { color: '#4CAF50', fontWeight: '700' },
  negative: { color: '#F44336', fontWeight: '700' },
  myActions: {
    backgroundColor: colors.inputBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginBottom: 16,
  },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 11, color: colors.placeholder, marginBottom: 4 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  updateButtonSuccess: {
    backgroundColor: '#2E7D32',
  },
  updateButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  endButton: {
    backgroundColor: '#C62828',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  endButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
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
  codeLabel: {
    fontSize: 10,
    color: colors.placeholder,
    letterSpacing: 2,
    marginBottom: 2,
  },
  code: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 4,
  },
  rulesCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  ruleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});