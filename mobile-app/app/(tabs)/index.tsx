import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes } from '../../src/constants/Colors';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Request camera permissions on mount
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Azure Lens needs camera access to scan and analyze images.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => ImagePicker.requestCameraPermissionsAsync() },
          ]
        );
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  const handleCameraPress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/camera');
    } catch (error) {
      console.error('Camera navigation error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const handleGalleryPress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        router.push({
          pathname: '/result',
          params: {
            imageUri: result.assets[0].uri,
            mode: 'auto',
          },
        });
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to select image from gallery');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Azure Lens</Text>
        <Text style={styles.subtitle}>AI-powered visual search and analysis</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Camera Button */}
        <TouchableOpacity 
          style={styles.cameraButton}
          onPress={handleCameraPress}
          disabled={isLoading}
        >
          <View style={styles.cameraButtonInner}>
            <Ionicons name="camera" size={48} color="white" />
            <Text style={styles.cameraButtonText}>Scan with Camera</Text>
          </View>
        </TouchableOpacity>

        {/* Gallery Button */}
        <TouchableOpacity 
          style={styles.galleryButton}
          onPress={handleGalleryPress}
          disabled={isLoading}
        >
          <Ionicons name="images" size={24} color={Colors.primary} />
          <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What Azure Lens can do:</Text>
          
          <View style={styles.feature}>
            <Ionicons name="eye" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Analyze and describe images</Text>
          </View>
          
          <View style={styles.feature}>
            <Ionicons name="text" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Extract text from images (OCR)</Text>
          </View>
          
          <View style={styles.feature}>
            <Ionicons name="language" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Translate detected text</Text>
          </View>
          
          <View style={styles.feature}>
            <Ionicons name="search" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Identify objects and landmarks</Text>
          </View>
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
    alignItems: 'center',
    paddingVertical: Sizes.xl,
    paddingHorizontal: Sizes.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Sizes.sm,
  },
  subtitle: {
    fontSize: Sizes.fontMd,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Sizes.lg,
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: Colors.primary,
    borderRadius: Sizes.radiusLg,
    marginBottom: Sizes.lg,
    overflow: 'hidden',
  },
  cameraButtonInner: {
    alignItems: 'center',
    paddingVertical: Sizes.xl,
    paddingHorizontal: Sizes.lg,
  },
  cameraButtonText: {
    color: 'white',
    fontSize: Sizes.fontLg,
    fontWeight: '600',
    marginTop: Sizes.md,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Sizes.radiusMd,
    paddingVertical: Sizes.md,
    paddingHorizontal: Sizes.lg,
    marginBottom: Sizes.xl,
  },
  galleryButtonText: {
    color: Colors.primary,
    fontSize: Sizes.fontMd,
    fontWeight: '600',
    marginLeft: Sizes.sm,
  },
  featuresContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Sizes.radiusMd,
    padding: Sizes.lg,
  },
  featuresTitle: {
    fontSize: Sizes.fontLg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Sizes.lg,
    textAlign: 'center',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Sizes.md,
  },
  featureText: {
    fontSize: Sizes.fontMd,
    color: Colors.text,
    marginLeft: Sizes.md,
    flex: 1,
  },
});
