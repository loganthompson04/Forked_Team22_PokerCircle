import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../../App';
import { colors } from '../theme/colors';
import {
  searchUsers,
  sendFriendRequest,
  respondToFriendRequest,
} from '../api/api';
import type { UserSearchResult } from '../api/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

type Props = StackScreenProps<RootStackParamList, 'FindFriends'>;

export default function FindFriendsScreen(_props: Props) {
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);
  const canSearch = trimmed.length > 0;

  function handleChangeText(text: string) {
    setQuery(text.replace(/\s{2,}/g, ' '));
  }

  async function handleSearch() {
    if (!canSearch) return;

    setHasSearched(true);
    setLoading(true);
    setError(null);

    try {
      const users = await searchUsers(trimmed);
      setResults(users);
    } catch (err: unknown) {
      setResults([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not search users — check your connection'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFriend(userId: string) {
    try {
      setError(null);
      await sendFriendRequest(userId);

      setResults((prev) =>
        prev.map((u) =>
          u.userId === userId ? { ...u, friendshipStatus: 'pending_sent' } : u
        )
      );

      Alert.alert('Success', 'Friend request sent!');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send friend request'
      );
    }
  }

  async function handleAcceptRequest(userId: string, requestId: number) {
    try {
      setError(null);
      await respondToFriendRequest(requestId, 'accept');

      setResults((prev) =>
        prev.map((u) =>
          u.userId === userId ? { ...u, friendshipStatus: 'accepted' } : u
        )
      );

      Alert.alert('Success', 'Friend request accepted!');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to accept friend request'
      );
    }
  }

  function renderActionButton(item: UserSearchResult) {
    switch (item.friendshipStatus) {
      case 'none':
        return (
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => handleAddFriend(item.userId)}
          >
            <Text style={styles.addButtonText}>Send Request</Text>
          </Pressable>
        );

      case 'pending_sent':
        return (
          <Pressable style={[styles.addButton, styles.addButtonDisabled]} disabled>
            <Text style={styles.addButtonText}>Request Sent</Text>
          </Pressable>
        );

      case 'pending_received':
        return (
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              handleAcceptRequest(item.userId, item.friendshipId ?? 0)
            }
          >
            <Text style={styles.addButtonText}>Accept</Text>
          </Pressable>
        );

      case 'accepted':
        return (
          <Pressable style={[styles.addButton, styles.addButtonDisabled]} disabled>
            <Text style={styles.addButtonText}>Already Friends</Text>
          </Pressable>
        );

      default:
        return null;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      <View style={styles.content}>
        <Text style={styles.title}>Find Friends</Text>
        <Text style={styles.label}>Search players by username</Text>

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. isabella24"
          placeholderTextColor="#888"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (!canSearch || loading) && styles.buttonDisabled,
            pressed && canSearch && !loading && styles.buttonPressed,
          ]}
          onPress={handleSearch}
          disabled={!canSearch || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Searching...' : 'Search'}
          </Text>
        </Pressable>

        {error && <ErrorMessage message={error} onRetry={handleSearch} />}

        {loading && <LoadingSpinner message="Searching..." />}

        {!loading && hasSearched && results.length === 0 && (
          <Text style={styles.emptyText}>No users found.</Text>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.resultRow}>
              <Text style={styles.username}>{item.username}</Text>
              {renderActionButton(item)}
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
