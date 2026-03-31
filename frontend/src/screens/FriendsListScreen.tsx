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
import { getFriends } from '../api/api';
import type { Friend } from '../types/invite';

type Props = StackScreenProps<RootStackParamList, 'FriendsList'>;

export default function FriendsListScreen({ navigation: _navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadFriends = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getFriends();

        if (mounted) {
          setFriends(data);
        }
      } catch (err: unknown) {
        console.error('FriendsListScreen load error:', err);
        if (mounted) {
          setFriends([]);
          setError(
            err instanceof Error
              ? err.message
              : 'Could not connect — check your connection'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadFriends();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <View style={styles.content}>
        <Text style={styles.title}>Friends</Text>

        {friends.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              No friends yet — find someone to play with!
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => String(item.userId)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.friendRow}>
                <Text style={styles.username}>{item.username}</Text>
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
    paddingHorizontal: 24,
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
    marginBottom: 16,
    letterSpacing: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  friendRow: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: 12,
    marginBottom: 10,
  },
  username: {
    color: colors.text,
    fontSize: 15,
  },
  emptyText: {
    color: colors.placeholder,
    fontSize: 15,
    textAlign: 'center',
  },
  loadingText: {
    color: colors.placeholder,
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: colors.primary,
    fontSize: 15,
    textAlign: 'center',
  },
});
