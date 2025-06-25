import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Sizes } from '../../src/constants/Colors';

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analysis History</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={Colors.gray} />
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptyText}>
            Your analyzed images will appear here. Start by scanning an image from the Home tab.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  title: {
    fontSize: Sizes.fontXl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Sizes.fontLg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Sizes.lg,
    marginBottom: Sizes.md,
  },
  emptyText: {
    fontSize: Sizes.fontMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
