import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import { getUserStats, getUserSessions, updateDisplayName, updateAvatar } from '../api/api';
import { BACKEND_URL } from '../config/api';
import type { UserStats, UserSession } from '../types/profile';
import AvatarDisplay from '../components/AvatarDisplay';
import AvatarPickerModal from '../components/AvatarPickerModal';

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

export default function ProfileScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number>(0);
  const [username, setUsername] = useState('');
  const [stats, setStats] = useState<UserStats>({
    sessionsPlayed: 0,
    totalNet: 0,
    biggestWin: 0,
    biggestLoss: 0,
  });
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include',
      });
      if (!meRes.ok) throw new Error('Not authenticated');
      const me = (await meRes.json()) as { userID: string; username: string; avatar?: string | null };

      const [fetchedStats, fetchedSessions] = await Promise.all([
        getUserStats(me.userID as any),
        getUserSessions(me.userID as any),
      ]);

      setUserId(me.userID as any);
      setUsername(me.username);
      setAvatar(me.avatar ?? null);
      setStats(fetchedStats);
      setSessions(fetchedSessions);
    }

    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit() {
    setEditValue(username);
    setEditError('');
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditError('');
  }

  async function confirmEdit() {
    if (editLoading) return;
    setEditLoading(true);
    try {
      const updated = await updateDisplayName(userId, editValue.trim());
      setUsername(updated);
      setEditMode(false);
      setEditError('');
    } catch (err: any) {
      setEditError(err.message ?? 'Failed to update display name');
    } finally {
      setEditLoading(false);
    }
  }

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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setPickerVisible(true)} style={styles.avatarWrapper}>
          <AvatarDisplay avatarId={avatar} size={72} />
          <Text style={styles.avatarEditHint}>Tap to change</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          {editMode ? (
            <>
              <TextInput
                style={styles.nameInput}
                value={editValue}
                onChangeText={setEditValue}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={confirmEdit}
              />
              <TouchableOpacity
                onPress={confirmEdit}
                disabled={editLoading}
                style={styles.editActionBtn}
              >
                <Text style={styles.editActionText}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEdit} style={styles.editActionBtn}>
                <Text style={styles.editActionText}>✕</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{username}</Text>
              <TouchableOpacity onPress={startEdit} style={styles.editIconBtn}>
                <Text style={styles.editIcon}>✎</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {editError ? <Text style={styles.editErrorText}>{editError}</Text> : null}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.sessionsPlayed}</Text>
            <Text style={styles.statLabel}>Sessions Played</Text>
          </View>

          <View style={styles.statCard}>
            <Text
              style={[
                styles.statValue,
                stats.totalNet >= 0 ? styles.positive : styles.negative,
              ]}
            >
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
              <TouchableOpacity
                style={styles.sessionRow}
                onPress={() => navigation.navigate('SessionDetail', { sessionCode: item.sessionCode })}
              >
                <View style={styles.sessionMain}>
                  <Text style={styles.sessionCode}>{item.sessionCode}</Text>
                  <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
                </View>

                <View style={styles.sessionRight}>
                  <Text
                    style={[
                      styles.sessionNet,
                      item.net >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {formatNet(item.net)}
                  </Text>
                  <Text style={styles.sessionPlayers}>{item.playerCount} players</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      <AvatarPickerModal
        visible={pickerVisible}
        currentAvatarId={avatar}
        onClose={() => setPickerVisible(false)}
        onSelect={async (id) => {
          const previous = avatar;
          setPickerVisible(false);
          setAvatar(id);
          try {
            await updateAvatar(userId, id);
          } catch {
            setAvatar(previous);
          }
        }}
      />
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

  header: {
    marginBottom: 10,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  backText: {
    color: colors.placeholder,
    fontSize: 14,
    fontWeight: '600',
  },

  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },

  avatarEditHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.placeholder,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    flex: 1,
  },

  editIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  editIcon: {
    fontSize: 22,
    color: colors.placeholder,
  },

  nameInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
    letterSpacing: 1,
  },

  editActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  editActionText: {
    fontSize: 22,
    color: colors.text,
  },

  editErrorText: {
    color: '#F44336',
    fontSize: 13,
    marginBottom: 12,
    marginTop: -12,
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
