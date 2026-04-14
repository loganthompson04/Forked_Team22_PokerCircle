import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { getLeaderboard } from '../api/api';
import { BACKEND_URL } from '../config/api';
import type { LeaderboardEntry } from '../api/api';
import AvatarDisplay from '../components/AvatarDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

type Props = StackScreenProps<RootStackParamList, 'Leaderboard'>;

function formatNet(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

export default function LeaderboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include',
      });
      if (!meRes.ok) throw new Error('Not authenticated');
      const me = (await meRes.json()) as { userID: string };

      const data = await getLeaderboard(me.userID);
      setLeaderboard(data);
    } catch (err: any) {
      console.error('Leaderboard load error:', err);
      setError(err.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading leaderboard..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorMessage message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>All-Time Net Winnings</Text>
        </View>

        {leaderboard.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No rankings available yet.</Text>
            <Text style={styles.emptySubtext}>Complete some sessions with friends to see them here!</Text>
          </View>
        ) : (
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.displayName}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <View style={styles.rankSection}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>

                <View style={styles.avatarSection}>
                  <AvatarDisplay avatarId={item.avatar} size={40} />
                </View>

                <View style={styles.infoSection}>
                  <Text style={styles.displayName}>{item.displayName}</Text>
                </View>

                <View style={styles.netSection}>
                  <Text
                    style={[
                      styles.netText,
                      item.netResult >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {formatNet(item.netResult)}
                  </Text>
                </View>
              </View>
            )}
          />
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 8,
  },
  backText: {
    color: colors.placeholder,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: colors.placeholder,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 12,
    marginBottom: 10,
  },
  rankSection: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.placeholder,
  },
  avatarSection: {
    marginRight: 12,
  },
  infoSection: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  netSection: {
    alignItems: 'flex-end',
  },
  netText: {
    fontSize: 16,
    fontWeight: '700',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: colors.placeholder,
    fontSize: 14,
    textAlign: 'center',
  },
});
