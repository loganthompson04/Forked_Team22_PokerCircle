import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { getSessionPlayers, getSessionResults } from '../api/api';
import type { PlayerResult, SettlementTransaction } from '../api/api';
import type { Player } from '../types/session';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

type Props = StackScreenProps<RootStackParamList, 'SessionDetail'>;

function formatAmount(value: number): string {
  return `$${Math.abs(value).toFixed(2)}`;
}

export default function SessionDetailScreen({ route, navigation }: Props) {
  const { sessionCode } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [playerData, resultsData] = await Promise.all([
        getSessionPlayers(sessionCode),
        getSessionResults(sessionCode),
      ]);

      setPlayers(playerData);
      setResults(resultsData.playerResults.sort((a, b) => b.netResult - a.netResult));
      setTransactions(resultsData.transactions);
    } catch (err: unknown) {
      console.error('SessionDetailScreen load error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load session details'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [sessionCode]);

  if (loading) {
    return <LoadingSpinner message="Loading session details..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ErrorMessage message={error} onRetry={loadData} />
          <TouchableOpacity
            style={styles.backButtonLarge}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonLargeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <Text style={styles.sessionCode}>{sessionCode}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Financial Breakdown Section */}
        <Text style={styles.sectionTitle}>Financial Breakdown</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.playerCell, styles.headerText]}>Player</Text>
            <Text style={[styles.cell, styles.amountCell, styles.headerText]}>Buy-in</Text>
            <Text style={[styles.cell, styles.amountCell, styles.headerText]}>Cash-out</Text>
            <Text style={[styles.cell, styles.amountCell, styles.headerText]}>Net</Text>
          </View>
          
          {players.map((p) => {
            const net = p.cashOut - (p.buyIn + p.rebuyTotal);
            return (
              <View key={p.displayName} style={styles.tableRow}>
                <Text style={[styles.cell, styles.playerCell]} numberOfLines={1}>
                  {p.displayName}
                </Text>
                <Text style={[styles.cell, styles.amountCell]}>
                  {formatAmount(p.buyIn + p.rebuyTotal)}
                </Text>
                <Text style={[styles.cell, styles.amountCell]}>
                  {formatAmount(p.cashOut)}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.amountCell,
                    styles.netText,
                    net > 0 ? styles.positive : net < 0 ? styles.negative : null,
                  ]}
                >
                  {net > 0 ? '+' : net < 0 ? '-' : ''}{formatAmount(net)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Settlements Section */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Settlements</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No payments needed — everyone is even.</Text>
          </View>
        ) : (
          transactions.map((t, idx) => (
            <View key={idx} style={styles.transactionCard}>
              <Text style={styles.transactionText}>
                <Text style={styles.debtorName}>{t.from}</Text>
                <Text style={styles.normalText}> pays </Text>
                <Text style={styles.creditorName}>{t.to}</Text>
              </Text>
              <Text style={styles.transactionAmount}>{formatAmount(t.amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 18,
    padding: 4,
  },
  backText: {
    color: colors.placeholder,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  sessionCode: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  table: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerText: {
    fontWeight: '700',
    color: colors.placeholder,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  cell: {
    fontSize: 13,
    color: colors.text,
  },
  playerCell: {
    flex: 2,
  },
  amountCell: {
    flex: 1.2,
    textAlign: 'right',
  },
  netText: {
    fontWeight: '700',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  transactionCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionText: {
    fontSize: 15,
    flex: 1,
  },
  debtorName: {
    color: '#F44336',
    fontWeight: '700',
  },
  creditorName: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  normalText: {
    color: colors.text,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 12,
  },
  emptyCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  emptyText: {
    color: colors.placeholder,
    fontSize: 14,
    textAlign: 'center',
  },
  backButtonLarge: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginTop: 20,
  },
  backButtonLargeText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
