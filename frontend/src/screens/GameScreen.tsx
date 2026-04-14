import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
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

function formatAmount(n: number) {
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

type PlayerCardProps = {
  player: Player;
  isMe: boolean;
  canRemove: boolean;
  onRemove: () => void;
};

function PlayerCard({ player, isMe, canRemove, onRemove }: PlayerCardProps) {
  const displayName = player.displayName ?? player.name ?? '';
  const totalIn = player.buyIn + player.rebuyTotal;
  const hasCashedOut = player.cashOut > 0;
  const net = hasCashedOut ? player.cashOut - totalIn : null;
  const rebuyCount =
    player.buyIn > 0 && player.rebuyTotal > 0
      ? Math.round(player.rebuyTotal / player.buyIn)
      : player.rebuyTotal > 0
        ? 1
        : 0;

  return (
    <View
      style={[
        styles.playerCard,
        isMe && styles.playerCardMe,
        hasCashedOut && styles.playerCardCashedOut,
      ]}
    >
      <View style={styles.playerCardLeft}>
        <AvatarDisplay
          avatarId={player.avatar}
          size={40}
          style={hasCashedOut ? styles.avatarDimmed : undefined}
        />
        <View style={styles.playerCardNameBlock}>
          <Text
            style={[styles.playerCardName, hasCashedOut && styles.textMuted]}
            numberOfLines={1}
          >
            {displayName}
            {isMe ? <Text style={styles.youLabel}> (You)</Text> : null}
          </Text>

          <View style={styles.playerStatRow}>
            {totalIn > 0 && (
              <View style={styles.statPill}>
                <Text style={styles.statPillLabel}>IN</Text>
                <Text style={styles.statPillValue}>{formatAmount(totalIn)}</Text>
              </View>
            )}

            {rebuyCount > 0 && (
              <View style={[styles.statPill, styles.statPillRebuy]}>
                <Text style={styles.statPillLabel}>↻</Text>
                <Text style={styles.statPillValue}>
                  {rebuyCount}x {formatAmount(player.rebuyTotal)}
                </Text>
              </View>
            )}

            {hasCashedOut && (
              <View style={[styles.statPill, styles.statPillCashOut]}>
                <Text style={styles.statPillLabel}>OUT</Text>
                <Text style={styles.statPillValue}>{formatAmount(player.cashOut)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.playerCardRight}>
        {hasCashedOut ? (
          <>
            <View style={styles.cashedOutBadge}>
              <Text style={styles.cashedOutBadgeText}>CASHED OUT</Text>
            </View>
            {net !== null && (
              <Text
                style={[
                  styles.netAmount,
                  net >= 0 ? styles.netPositive : styles.netNegative,
                ]}
              >
                {net >= 0 ? '+' : ''}
                {formatAmount(net)}
              </Text>
            )}
          </>
        ) : (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>PLAYING</Text>
          </View>
        )}

        {canRemove && (
          <Pressable style={styles.removeButton} onPress={onRemove}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

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

  const myPlayerNameRef = useRef<string | null>(null);
  const sessionCodeRef = useRef(sessionCode);

  const allCashedOut = players.length > 0 && players.every((p) => p.cashOut > 0);
  const cashedOutCount = players.filter((p) => p.cashOut > 0).length;

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
      if (!active || payload.sessionCode !== sessionCodeRef.current) return;
      setPlayers(payload.players);
    };

    const handleComplete = (payload: { sessionCode: string }) => {
      if (!active) return;
      navigation.replace('Results', { sessionCode: payload.sessionCode });
    };

    const handlePlayerRemoved = (payload: {
      sessionCode: string;
      removedDisplayName: string;
    }) => {
      if (!active || payload.sessionCode !== sessionCodeRef.current) return;

      const removedName = payload.removedDisplayName.trim().toLowerCase();

      setPlayers((prev) =>
        prev.filter(
          (p) => ((p.displayName ?? p.name ?? '').trim().toLowerCase() !== removedName),
        ),
      );

      if (removedName === (myPlayerNameRef.current ?? '').trim().toLowerCase()) {
        Alert.alert('Removed from Session', 'The host removed you from the game.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('finance:update', handleFinanceUpdate);
    socket.on('game:complete', handleComplete);
    socket.on('player:removed', handlePlayerRemoved);

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

        const auth = (await authRes.json()) as { userID: string; username: string };
        myPlayerNameRef.current = auth.username;

        if (!active) return;

        setMyPlayerName(auth.username);
        setIsHost(auth.userID === sessionRes.hostUserId);
        setPlayers(sessionRes.players);
        setBuyInAmount(sessionRes.buyInAmount ?? 0);
        setMaxRebuys(sessionRes.maxRebuys ?? 0);

        const me = sessionRes.players.find(
          (p) => ((p.displayName ?? p.name ?? '').trim() === auth.username.trim()),
        );

        if (me) {
          if (me.buyIn > 0) setBuyIn(me.buyIn.toString());
          else if (sessionRes.buyInAmount > 0) setBuyIn(sessionRes.buyInAmount.toString());

          if (me.rebuyTotal > 0) setRebuy(me.rebuyTotal.toString());
          if (me.cashOut > 0) setCashOut(me.cashOut.toString());
        } else if (sessionRes.buyInAmount > 0) {
          setBuyIn(sessionRes.buyInAmount.toString());
        }

        setLoading(false);

        if (socket.connected) handleConnect();
        else socket.connect();
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
      socket.off('player:removed', handlePlayerRemoved);
    };
  }, [sessionCode, navigation]);

  async function handleRemovePlayer(displayName: string) {
    const cleanName = displayName.trim();

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Remove ${cleanName} from the session?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Remove Player',
              `Remove ${cleanName} from the session?`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (!confirmed) return;

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/sessions/${sessionCode}/players/${encodeURIComponent(cleanName)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? 'Could not remove player');
      }

      setPlayers((prev) =>
        prev.filter(
          (p) => ((p.displayName ?? p.name ?? '').trim().toLowerCase() !== cleanName.toLowerCase()),
        ),
      );
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not remove player',
      );
    }
  }

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
    } catch (err: unknown) {
      setFinanceError(err instanceof Error ? err.message : 'Failed to update finances');
    } finally {
      setIsUpdatingFinances(false);
    }
  }

  async function handleEndSession() {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(
            'This will finalise all results and show the settlement screen to everyone. Are you sure?',
          )
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'End Session',
              'This will finalise all results and show the settlement screen to everyone. Are you sure?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                {
                  text: 'End Session',
                  style: 'destructive',
                  onPress: () => resolve(true),
                },
              ],
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
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not end the session',
      );
      setIsEnding(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading game..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeLabel}>SESSION</Text>
              <Text style={styles.code}>{sessionCode}</Text>
            </View>

            {(buyInAmount > 0 || maxRebuys > 0) && (
              <View style={styles.rulesRow}>
                {buyInAmount > 0 && (
                  <View style={styles.ruleChip}>
                    <Text style={styles.ruleChipText}>
                      Buy-in {formatAmount(buyInAmount)}
                    </Text>
                  </View>
                )}
                <View style={styles.ruleChip}>
                  <Text style={styles.ruleChipText}>
                    Rebuys: {maxRebuys === 0 ? 'Unlimited' : `Max ${maxRebuys}`}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Players</Text>
            <View style={styles.sectionBadgeRow}>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{players.length} total</Text>
              </View>
              {cashedOutCount > 0 && (
                <View style={[styles.countBadge, styles.countBadgeCashedOut]}>
                  <Text style={styles.countBadgeText}>
                    {cashedOutCount} cashed out
                  </Text>
                </View>
              )}
            </View>
          </View>

          <FlatList
            data={players}
            renderItem={({ item }) => {
              const displayName = (item.displayName ?? item.name ?? '').trim();
              const isMe = displayName === (myPlayerName ?? '').trim();
              const canRemove = isHost && !isMe;

              return (
                <PlayerCard
                  player={item}
                  isMe={isMe}
                  canRemove={canRemove}
                  onRemove={() => handleRemovePlayer(displayName)}
                />
              );
            }}
            keyExtractor={(p) =>
              p.playerId || (p.displayName ?? p.name)?.trim() || Math.random().toString()
            }
            contentContainerStyle={styles.playerList}
            scrollEnabled={false}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>YOUR FINANCES</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.financeCard}>
            <Text style={styles.financeHint}>
              Enter your totals below and tap Confirm — you can update any time during the
              session.
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Buy-in ($)</Text>
                <TextInput
                  style={styles.input}
                  value={buyIn}
                  onChangeText={(v) => {
                    setBuyIn(v);
                    setFinanceError(null);
                  }}
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
                  onChangeText={(v) => {
                    setRebuy(v);
                    setFinanceError(null);
                  }}
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
                  onChangeText={(v) => {
                    setCashOut(v);
                    setFinanceError(null);
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            {financeError && <Text style={styles.errorText}>{financeError}</Text>}

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
                  {saveSuccess ? '✓  Saved!' : 'Confirm My Totals'}
                </Text>
              )}
            </Pressable>
          </View>

          {isHost && (
            <View style={styles.endSessionSection}>
              <View style={styles.endProgressRow}>
                <Text style={styles.endProgressLabel}>
                  {allCashedOut
                    ? 'All players have cashed out — ready to end!'
                    : `${cashedOutCount} / ${players.length} players cashed out`}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width:
                          players.length > 0
                            ? `${(cashedOutCount / players.length) * 100}%`
                            : '0%',
                      },
                    ]}
                  />
                </View>
              </View>

              {!allCashedOut && (
                <Text style={styles.endHelperText}>
                  The session can be ended once every player has entered their cash-out
                  amount.
                </Text>
              )}

              <Pressable
                style={[
                  styles.endButton,
                  (!allCashedOut || isEnding) && styles.endButtonDisabled,
                ]}
                onPress={handleEndSession}
                disabled={!allCashedOut || isEnding}
              >
                {isEnding ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text
                    style={[
                      styles.endButtonText,
                      !allCashedOut && styles.endButtonTextDisabled,
                    ]}
                  >
                    End Session &amp; See Results
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  codeBadge: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
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
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 5,
  },
  rulesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ruleChip: {
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  ruleChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.placeholder,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  countBadge: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  countBadgeCashedOut: {
    borderColor: '#2E7D32',
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  countBadgeText: {
    fontSize: 11,
    color: colors.placeholder,
    fontWeight: '600',
  },

  playerList: {
    gap: 8,
  },
  playerCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerCardMe: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  playerCardCashedOut: {
    borderColor: '#2E7D32',
    backgroundColor: 'rgba(46,125,50,0.06)',
  },
  playerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  avatarDimmed: {
    opacity: 0.55,
  },
  playerCardNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  playerCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 5,
  },
  textMuted: {
    color: colors.placeholder,
  },
  youLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.placeholder,
  },
  playerStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statPillRebuy: {
    borderColor: 'rgba(255,193,7,0.3)',
    backgroundColor: 'rgba(255,193,7,0.06)',
  },
  statPillCashOut: {
    borderColor: 'rgba(76,175,80,0.3)',
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  statPillLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.placeholder,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statPillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  playerCardRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 10,
    flexShrink: 0,
  },
  cashedOutBadge: {
    backgroundColor: '#1B5E20',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cashedOutBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A5D6A7',
    letterSpacing: 0.5,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 0.5,
  },
  netAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  netPositive: {
    color: '#4CAF50',
  },
  netNegative: {
    color: '#EF5350',
  },
  removeButton: {
    marginTop: 8,
    backgroundColor: '#8B1E1E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-end',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inputBorder,
  },
  dividerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.placeholder,
    letterSpacing: 2,
  },

  financeCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginBottom: 20,
  },
  financeHint: {
    fontSize: 12,
    color: colors.placeholder,
    marginBottom: 14,
    lineHeight: 17,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: colors.placeholder,
    marginBottom: 5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorText: {
    color: '#EF5350',
    fontSize: 12,
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
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  endSessionSection: {
    gap: 12,
    marginBottom: 8,
  },
  endProgressRow: {
    gap: 8,
  },
  endProgressLabel: {
    fontSize: 12,
    color: colors.placeholder,
    textAlign: 'center',
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.inputBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  endHelperText: {
    fontSize: 12,
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  endButton: {
    backgroundColor: '#C62828',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endButtonDisabled: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  endButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  endButtonTextDisabled: {
    color: colors.placeholder,
  },
});
