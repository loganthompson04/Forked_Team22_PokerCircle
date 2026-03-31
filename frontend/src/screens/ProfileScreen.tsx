import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { getUserStats, getUserSessions } from '../api/api';
import { BACKEND_URL } from '../config/api';
import type { UserStats, UserSession } from '../types/profile';

type Props = StackScreenProps<RootStackParamList, 'Profile'>;

function formatNet(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProfileScreen({ navigation: _navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [stats, setStats] = useState<UserStats>({
    sessionsPlayed: 0,
    totalNet: 0,
    biggestWin: 0,
    biggestLoss: 0,
  });
  const [sessions, setSessions] = useState<UserSession[]>([]);

  useEffect(() => {
    async function load() {
      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include',
      });
      if (!meRes.ok) throw new Error('Not authenticated');
      const me = await meRes.json() as { userId: number; username: string };

      const [fetchedStats, fetchedSessions] = await Promise.all([
        getUserStats(me.userId),
        getUserSessions(me.userId),
      ]);

      setUsername(me.username);
      setStats(fetchedStats);
      setSessions(fetchedSessions);
    }

    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <View style={styles.content}>
        <Text style={styles.title}>{username}</Text>

        {/* Stats cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.sessionsPlayed}</Text>
            <Text style={styles.statLabel}>Sessions Played</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, stats.totalNet >= 0 ? styles.positive : styles.negative]}>
              {formatNet(stats.totalNet)}
            </Text>
            <Text style={styles.statLabel}>Total Net</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.positive]}>
              {formatNet(stats.biggestWin)}
            </Text>
            <Text style={styles.statLabel}>Biggest Win</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.negative]}>
              {formatNet(stats.biggestLoss)}
            </Text>
            <Text style={styles.statLabel}>Biggest Loss</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Session History</Text>

        {sessions.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No completed sessions yet</Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.sessionCode}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.sessionRow}>
                <View style={styles.sessionMain}>
                  <Text style={styles.sessionCode}>{item.sessionCode}</Text>
                  <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={[styles.sessionNet, item.net >= 0 ? styles.positive : styles.negative]}>
                    {formatNet(item.net)}
                  </Text>
                  <Text style={styles.sessionPlayers}>{item.playerCount} players</Text>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 20,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.placeholder,
    textAlign: 'center',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyText: {
    color: colors.placeholder,
    fontSize: 15,
    textAlign: 'center',
  },
  sessionRow: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionMain: {
    flex: 1,
  },
  sessionCode: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  sessionDate: {
    color: colors.placeholder,
    fontSize: 12,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionNet: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  sessionPlayers: {
    color: colors.placeholder,
    fontSize: 12,
  },
});
