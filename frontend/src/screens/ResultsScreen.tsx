import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
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
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

type Props = StackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ route, navigation }: Props) {
  const { sessionCode } = route.params;

  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getSessionResults(sessionCode);
      const sorted = [...data.playerResults].sort(
        (a, b) => b.netResult - a.netResult
      );

      setPlayerResults(sorted);
      setTransactions(data.transactions);
    } catch (err: unknown) {
      console.error('ResultsScreen load error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect — check your connection'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResults();
  }, [sessionCode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
      }
    });

    return unsubscribe;
  }, [navigation]);

  const openUrlWithFallback = async (primaryUrl: string, fallbackUrl: string) => {
    try {
      const supported = await Linking.canOpenURL(primaryUrl);

      if (supported) {
        await Linking.openURL(primaryUrl);
      } else {
        await Linking.openURL(fallbackUrl);
      }
    } catch (err) {
      console.error('Payment link error:', err);
      Alert.alert('Error', 'Could not open payment link.');
    }
  };

  const handleVenmoPayment = async (to: string, amount: number) => {
    const note = encodeURIComponent(`PokerCircle payment for session ${sessionCode}`);
    const venmoAppUrl = `venmo://paycharge?txn=pay&amount=${amount.toFixed(2)}&note=${note}`;
    const venmoWebUrl = 'https://venmo.com/';

    Alert.alert(
      'Open Venmo',
      `Recipient handle for ${to} is not saved yet, so Venmo will open and you can finish the payment manually.`
    );

    await openUrlWithFallback(venmoAppUrl, venmoWebUrl);
  };

  const handlePayPalPayment = async (to: string) => {
    Alert.alert(
      'Open PayPal',
      `PayPal.Me handle for ${to} is not saved yet, so PayPal will open and you can finish the payment manually.`
    );

    await openUrlWithFallback('paypal://', 'https://www.paypal.com/');
  };

  const handleCashAppPayment = async (to: string) => {
    Alert.alert(
      'Open Cash App',
      `Cash App handle for ${to} is not saved yet, so Cash App will open and you can finish the payment manually.`
    );

    await openUrlWithFallback('cashapp://', 'https://cash.app/');
  };

  if (loading) {
    return <LoadingSpinner message="Calculating results..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ErrorMessage message={error} onRetry={loadResults} />
          <Pressable style={styles.doneButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.doneButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.code}>{sessionCode}</Text>
        </View>

        <Text style={styles.sectionLabel}>Net Results</Text>

        {playerResults.map((item) => {
          const isWinner = item.netResult > 0;
          const isLoser = item.netResult < 0;
          const sign = isWinner ? '+' : '';

          return (
            <View key={item.displayName} style={styles.resultRow}>
              <View style={styles.resultLeft}>
                <Text style={styles.medal}>
                  {isWinner ? 'WIN' : isLoser ? 'LOSS' : 'EVEN'}
                </Text>
                <Text style={styles.playerName}>{item.displayName}</Text>
              </View>

              <Text
                style={[
                  styles.netAmount,
                  isWinner ? styles.positive : null,
                  isLoser ? styles.negative : null,
                ]}
              >
                {sign}${Math.abs(item.netResult).toFixed(2)}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionLabelWithSpacing}>Who Pays Who</Text>

        {transactions.length === 0 ? (
          <View style={styles.evenBox}>
            <Text style={styles.evenText}>Everyone is even — no payments needed.</Text>
          </View>
        ) : (
          transactions.map((t, idx) => (
            <View key={idx} style={styles.transactionCard}>
              <View style={styles.transactionRow}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.fromName}>{t.from}</Text>
                  <Text style={styles.arrow}> to </Text>
                  <Text style={styles.toName}>{t.to}</Text>
                </View>
                <Text style={styles.transactionAmount}>${t.amount.toFixed(2)}</Text>
              </View>

              <View style={styles.paymentButtonsRow}>
                <Pressable
                  style={[styles.payButton, styles.venmoButton]}
                  onPress={() => handleVenmoPayment(t.to, t.amount)}
                >
                  <Text style={styles.payButtonText}>Venmo</Text>
                </Pressable>

                <Pressable
                  style={[styles.payButton, styles.paypalButton]}
                  onPress={() => handlePayPalPayment(t.to)}
                >
                  <Text style={styles.payButtonText}>PayPal</Text>
                </Pressable>

                <Pressable
                  style={[styles.payButton, styles.cashAppButton]}
                  onPress={() => handleCashAppPayment(t.to)}
                >
                  <Text style={styles.payButtonText}>Cash App</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Pressable
          style={({ pressed }) => [
            styles.doneButton,
            pressed ? styles.doneButtonPressed : null,
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
  },
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.placeholder,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLabelWithSpacing: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.placeholder,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 10,
  },
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
  },
  medal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.placeholder,
    marginRight: 10,
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
  transactionCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  paymentButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  payButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  venmoButton: {
    backgroundColor: '#3D95CE',
  },
  paypalButton: {
    backgroundColor: '#003087',
  },
  cashAppButton: {
    backgroundColor: '#00C244',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  doneButtonPressed: {
    opacity: 0.85,
  },
  doneButtonText: {
    color: colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
});
