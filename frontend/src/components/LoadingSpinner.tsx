import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

type Props = {
  message?: string;
};

export default function LoadingSpinner({ message = 'Loading...' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
  },
});