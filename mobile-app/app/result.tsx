import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes } from '../src/constants/Colors';
import { apiService } from '../src/services/api';
import { AnalysisResult } from '../src/types';
import ChatInterface from '../components/ChatInterface';
import { AnalysisResults } from '../src/services/chat';

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const { imageUri, mode } = params;
  
  const [loading, setLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (imageUri) {
      analyzeImage();
    }
  }, [imageUri]);

  const analyzeImage = async () => {
    if (!imageUri || typeof imageUri !== 'string') {
      setError('No image provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Starting enhanced image analysis with GPT-4o...');
      const result = await apiService.analyzeImageEnhanced(imageUri);

      setAnalysisResult(result);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log('✅ Analysis completed successfully');
    } catch (err: any) {
      console.error('Analysis error:', err);
      
      // More descriptive error messages
      let errorMessage = 'Failed to analyze the image. Please try again.';
      
      if (err.message?.includes('too large')) {
        errorMessage = 'The image is too large. Please try with a smaller image or take a new photo.';
      } else if (err.message?.includes('not allowed to be zero')) {
        errorMessage = 'Invalid image file. Please try taking a new photo.';
      } else if (err.message?.includes('Invalid file type') || err.message?.includes('Only image files')) {
        errorMessage = 'The file format is not supported. Please try taking a new photo.';
      } else if (err.message?.includes('empty or corrupted')) {
        errorMessage = 'The image appears to be corrupted. Please try taking a new photo.';
      } else if (err.message?.includes('not a valid image')) {
        errorMessage = 'The selected file is not a valid image. Please try taking a new photo.';
      } else if (err.message?.includes('Failed to process image')) {
        errorMessage = 'Unable to process the image. Please try with a different image.';
      } else if (err.message?.includes('Network Error') || err.message?.includes('timeout')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      } else if (err.error && err.message) {
        errorMessage = `${err.error}: ${err.message}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      Alert.alert('Analysis Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  const retakePhoto = () => {
    router.replace('/camera');
  };

  const openChat = () => {
    if (analysisResult) {
      setShowChat(true);
    }
  };

  const closeChat = () => {
    setShowChat(false);
  };

  // Convert analysis result to chat service format
  const convertToAnalysisResults = (result: AnalysisResult): AnalysisResults => {
    // Handle enhanced analysis results
    if (result.enhanced && result.data) {
      const data = result.data;
      return {
        caption: data.caption,
        description: data.description,
        objects: data.objects || [],
        people: data.people || [],
        tags: data.tags || [],
        text: data.text || [],
        color: data.color,
        // Enhanced fields for better chat experience
        enhanced: true,
        analysis: data.analysis,
        sceneContext: data.sceneContext,
        activities: data.activities,
        moodAtmosphere: data.moodAtmosphere,
        colorsComposition: data.colorsComposition,
        interestingDetails: data.interestingDetails
      };
    }
    
    // Handle standard analysis results
    return {
      caption: result.analysis.caption ? {
        text: result.analysis.caption,
        confidence: result.analysis.confidence || 0
      } : undefined,
      objects: result.analysis.objects.map(obj => ({
        object: obj.name,
        confidence: obj.confidence,
        rectangle: { x: 0, y: 0, w: 0, h: 0 } // Simplified for now
      })),
      tags: result.analysis.tags.map(tag => ({
        name: tag.name,
        confidence: tag.confidence
      })),
      people: result.analysis.people?.map(person => ({
        rectangle: { x: 0, y: 0, w: 0, h: 0 } // Simplified for now
      })) || []
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis Result</Text>
        <View style={styles.headerActions}>
          {analysisResult && !loading && (
            <TouchableOpacity style={styles.headerButton} onPress={openChat}>
              <Ionicons name="chatbubble-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerButton} onPress={retakePhoto}>
            <Ionicons name="camera" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Image Preview */}
        {imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri as string }} style={styles.image} />
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Analyzing image...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={Colors.error} />
            <Text style={styles.errorTitle}>Analysis Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={analyzeImage}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {analysisResult && !loading && (
          <View style={styles.resultsContainer}>
            {/* Enhanced Analysis Display */}
            {analysisResult.enhanced && analysisResult.data ? (
              <View>
                {/* Main Description */}
                {analysisResult.data.analysis?.mainDescription && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✨ AI Description</Text>
                    <Text style={styles.enhancedDescription}>
                      {analysisResult.data.analysis.mainDescription}
                    </Text>
                    <Text style={styles.enhancedModel}>Enhanced by GPT-4o</Text>
                  </View>
                )}

                {/* Scene Context & Mood */}
                {(analysisResult.data.sceneContext || analysisResult.data.moodAtmosphere) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎭 Scene & Mood</Text>
                    {analysisResult.data.sceneContext && (
                      <Text style={styles.enhancedText}>
                        <Text style={styles.enhancedLabel}>Setting: </Text>
                        {analysisResult.data.sceneContext}
                      </Text>
                    )}
                    {analysisResult.data.moodAtmosphere && (
                      <Text style={styles.enhancedText}>
                        <Text style={styles.enhancedLabel}>Mood: </Text>
                        {analysisResult.data.moodAtmosphere}
                      </Text>
                    )}
                  </View>
                )}

                {/* Activities */}
                {analysisResult.data.activities && analysisResult.data.activities.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎬 Activities</Text>
                    {analysisResult.data.activities.map((activity: string, index: number) => (
                      <Text key={index} style={styles.enhancedListItem}>• {activity}</Text>
                    ))}
                  </View>
                )}

                {/* Interesting Details */}
                {analysisResult.data.interestingDetails && analysisResult.data.interestingDetails.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔍 Interesting Details</Text>
                    {analysisResult.data.interestingDetails.map((detail: string, index: number) => (
                      <Text key={index} style={styles.enhancedListItem}>• {detail}</Text>
                    ))}
                  </View>
                )}

                {/* Colors & Composition */}
                {analysisResult.data.colorsComposition && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎨 Visual Composition</Text>
                    <Text style={styles.enhancedText}>{analysisResult.data.colorsComposition}</Text>
                  </View>
                )}

                {/* Objects (if any) */}
                {analysisResult.data.analysis?.objects && analysisResult.data.analysis.objects.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📦 Key Objects</Text>
                    <View style={styles.tagsContainer}>
                      {analysisResult.data.analysis.objects.map((obj: string, index: number) => (
                        <View key={index} style={styles.enhancedTag}>
                          <Text style={styles.tagText}>{obj}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // Standard Analysis Display
              <View>
                {/* Description */}
                {analysisResult.analysis.caption && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>
                      {analysisResult.analysis.caption}
                    </Text>
                    {analysisResult.analysis.confidence && (
                      <Text style={styles.confidence}>
                        Confidence: {Math.round(analysisResult.analysis.confidence * 100)}%
                      </Text>
                    )}
                  </View>
                )}

                {/* Objects */}
                {analysisResult.analysis.objects.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Objects Detected</Text>
                    {analysisResult.analysis.objects.map((obj, index) => (
                      <View key={index} style={styles.listItem}>
                        <Text style={styles.listItemText}>{obj.name}</Text>
                        <Text style={styles.listItemConfidence}>
                          {Math.round(obj.confidence * 100)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Tags */}
                {analysisResult.analysis.tags.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tags</Text>
                    <View style={styles.tagsContainer}>
                      {analysisResult.analysis.tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{tag.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Chat Modal */}
      <Modal
        visible={showChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeChat}
      >
        {analysisResult && (
          <ChatInterface
            analysisResults={convertToAnalysisResults(analysisResult)}
            visible={showChat}
            onClose={closeChat}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  headerButton: {
    padding: Sizes.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Sizes.fontLg,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.lg,
  },
  image: {
    width: '90%',
    aspectRatio: 1,
    borderRadius: Sizes.radiusMd,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.xxl,
  },
  loadingText: {
    marginTop: Sizes.md,
    fontSize: Sizes.fontMd,
    color: Colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Sizes.xxl,
    paddingHorizontal: Sizes.lg,
  },
  errorTitle: {
    fontSize: Sizes.fontLg,
    fontWeight: '600',
    color: Colors.error,
    marginTop: Sizes.md,
  },
  errorText: {
    fontSize: Sizes.fontMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Sizes.sm,
    marginBottom: Sizes.lg,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Sizes.lg,
    paddingVertical: Sizes.md,
    borderRadius: Sizes.radiusMd,
  },
  retryButtonText: {
    color: 'white',
    fontSize: Sizes.fontMd,
    fontWeight: '600',
  },
  resultsContainer: {
    paddingHorizontal: Sizes.lg,
  },
  section: {
    marginBottom: Sizes.xl,
  },
  sectionTitle: {
    fontSize: Sizes.fontLg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Sizes.md,
  },
  description: {
    fontSize: Sizes.fontMd,
    color: Colors.text,
    lineHeight: 24,
  },
  confidence: {
    fontSize: Sizes.fontSm,
    color: Colors.textSecondary,
    marginTop: Sizes.sm,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Sizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  listItemText: {
    fontSize: Sizes.fontMd,
    color: Colors.text,
    flex: 1,
  },
  listItemConfidence: {
    fontSize: Sizes.fontSm,
    color: Colors.textSecondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Sizes.sm,
  },
  tag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: Sizes.radiusSm,
    borderWidth: 1,
    borderColor: Colors.grayLight,
  },
  tagText: {
    fontSize: Sizes.fontSm,
    color: Colors.text,
  },
  // Enhanced analysis styles
  enhancedDescription: {
    fontSize: Sizes.fontMd,
    color: Colors.text,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  enhancedModel: {
    fontSize: Sizes.fontXs,
    color: Colors.primary,
    marginTop: Sizes.xs,
    fontWeight: '500',
  },
  enhancedText: {
    fontSize: Sizes.fontMd,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Sizes.sm,
  },
  enhancedLabel: {
    fontWeight: '600',
    color: Colors.primary,
  },
  enhancedListItem: {
    fontSize: Sizes.fontMd,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Sizes.xs,
  },
  enhancedTag: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: Sizes.radiusSm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
});
