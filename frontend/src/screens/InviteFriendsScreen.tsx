import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import type { Friend } from '../types/invite';
import { getFriends, getPendingInvites, sendInvite } from '../api/api';

type Props = StackScreenProps<RootStackParamList, 'InviteFriends'>;

type InviteState = 'idle' | 'loading' | 'sent' | 'error';

export default function InviteFriendsScreen({ route }: Props) {
  const { sessionCode } = route.params;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [inviteStates, setInviteStates] = useState<Record<string, InviteState>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingFriends(true);
    setFetchError(null);
    try {
      const [friendList, pendingInvites] = await Promise.all([
        getFriends(),
        getPendingInvites(),
      ]);
      setFriends(friendList);

      // Pre-mark friends who already have a pending invite for this session
      const alreadyInvited = new Set(
        pendingInvites
          .filter((inv) => inv.sessionCode === sessionCode)
          .map((inv) => inv.inviteeId)
      );
      const initialStates: Record<string, InviteState> = {};
      for (const f of friendList) {
        initialStates[f.userId] = alreadyInvited.has(f.userId) ? 'sent' : 'idle';
      }
      setInviteStates(initialStates);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load friends');
    } finally {
      setLoadingFriends(false);
    }
  }

  async function handleInvite(friend: Friend) {
    setInviteStates((prev) => ({ ...prev, [friend.userId]: 'loading' }));
    try {
      await sendInvite(sessionCode, friend.userId);
      setInviteStates((prev) => ({ ...prev, [friend.userId]: 'sent' }));
    } catch {
      setInviteStates((prev) => ({ ...prev, [friend.userId]: 'error' }));
    }
  }

  if (loadingFriends) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (fetchError !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <Pressable style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Invite Friends</Text>
        <Text style={styles.subtitle}>Session: {sessionCode}</Text>

        <FlatList
          data={friends}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const state = inviteStates[item.userId] ?? 'idle';
            const sent = state === 'sent';
            const loading = state === 'loading';

            return (
              <View style={styles.resultRow}>
                <Text style={styles.username}>{item.username}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.inviteButton,
                    (sent || loading) && styles.inviteButtonDisabled,
                    pressed && !sent && !loading && styles.buttonPressed,
                  ]}
                  onPress={() => handleInvite(item)}
                  disabled={sent || loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textOnPrimary} size="small" />
                  ) : (
                    <Text style={styles.inviteButtonText}>
                      {sent ? 'Invited' : state === 'error' ? 'Retry' : 'Invite'}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No friends yet. Add friends from the Home screen.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: colors.placeholder,
    marginBottom: 24,
    letterSpacing: 2,
  },
  listContent: {
    paddingBottom: 24,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  username: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  inviteButton: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  inviteButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  inviteButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.placeholder,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: colors.primary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
