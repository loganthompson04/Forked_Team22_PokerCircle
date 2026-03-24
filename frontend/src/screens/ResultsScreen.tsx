import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { getSessionResults } from '../api/api';
import type { PlayerResult, SettlementTransaction } from '../api/api';
import { colors } from '../theme/colors';

type Props = StackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ route, navigation }: Props) {
  const { sessionCode } = route.params;

  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSessionResults(sessionCode)
      .then((data) => {
        // Sort: biggest winners first, then losers
        const sorted = [...data.playerResults].sort((a, b) => b.netResult - a.netResult);
        setPlayerResults(sorted);
        setTransactions(data.transactions);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      })
      .finally(() => setLoading(false));
  }, [sessionCode]);

  // Prevent hardware back — results are a terminal screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only intercept the back action; let navigate('Home') through
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Calculating results…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.doneButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.doneButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.code}>{sessionCode}</Text>
        </View>

        {/* Net results */}
        <Text style={styles.sectionLabel}>Net Results</Text>
        {playerResults.map((item) => {
          const isWinner = item.netResult > 0;
          const isLoser = item.netResult < 0;
          const sign = isWinner ? '+' : '';
          return (
            <View key={item.displayName} style={styles.resultRow}>
              <View style={styles.resultLeft}>
                <Text style={styles.medal}>
                  {isWinner ? '🟢' : isLoser ? '🔴' : '⚪️'}
                </Text>
                <Text style={styles.playerName}>{item.displayName}</Text>
              </View>
              <Text
                style={[
                  styles.netAmount,
                  isWinner && styles.positive,
                  isLoser && styles.negative,
                ]}
              >
                {sign}${Math.abs(item.netResult).toFixed(2)}
              </Text>
            </View>
          );
        })}

        {/* Settlement */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Who Pays Who</Text>
        {transactions.length === 0 ? (
          <View style={styles.evenBox}>
            <Text style={styles.evenText}>🎉 Everyone is even — no payments needed!</Text>
          </View>
        ) : (
          transactions.map((t, idx) => (
            <View key={idx} style={styles.transactionRow}>
              <View style={styles.transactionLeft}>
                <Text style={styles.fromName}>{t.from}</Text>
                <Text style={styles.arrow}> → </Text>
                <Text style={styles.toName}>{t.to}</Text>
              </View>
              <Text style={styles.transactionAmount}>${t.amount.toFixed(2)}</Text>
            </View>
          ))
        )}

        {/* Done */}
        <Pressable
          style={({ pressed }) => [
            styles.doneButton,
            pressed && styles.doneButtonPressed,
          ]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },

  // Header
  headerRow: {
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 1,
  },
  code: {
    fontSize: 13,
    color: colors.placeholder,
    letterSpacing: 4,
    marginTop: 2,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.placeholder,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Net result rows
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medal: {
    fontSize: 16,
  },
  playerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  netAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: colors.primary,
  },

  // Settlement rows
  evenBox: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
  },
  evenText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  fromName: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  arrow: {
    color: colors.placeholder,
    fontSize: 15,
    marginHorizontal: 2,
  },
  toName: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '700',
  },
  transactionAmount: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 12,
  },

  // Done button
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  doneButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Loading / error
  loadingText: {
    color: colors.placeholder,
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: colors.primary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
});
