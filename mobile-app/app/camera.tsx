import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  StatusBar,
} from 'react-native';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes } from '../src/constants/Colors';

const { width, height } = Dimensions.get('window');

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
        imageType: 'jpg', // Explicitly set to JPEG
      });

      if (photo && photo.uri) {
        console.log('📸 Photo captured:', {
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
        });

        // Navigate to result screen with the captured image
        router.replace({
          pathname: '/result',
          params: {
            imageUri: photo.uri,
            mode: 'auto',
          },
        });
      } else {
        throw new Error('Failed to capture photo - no image data received');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert(
        'Camera Error', 
        'Failed to capture image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleFlash = () => {
    setFlash(flash === 'off' ? 'on' : 'off');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const flipCamera = () => {
    setType(type === 'back' ? 'front' : 'back');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goBack = () => {
    router.back();
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={Colors.gray} />
        <Text style={styles.permissionTitle}>Camera Permission Denied</Text>
        <Text style={styles.permissionText}>
          Please enable camera access in your device settings to use this feature.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* Camera View */}
      <CameraView 
        style={styles.camera} 
        facing={type} 
        flash={flash}
        ref={cameraRef}
      >
        {/* Header Controls */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.headerButton} onPress={toggleFlash}>
            <Ionicons 
              name={flash === 'off' ? "flash-off" : "flash"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        {/* Footer Controls */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            {/* Gallery Button Placeholder */}
            <View style={styles.sideButton} />
            
            {/* Capture Button */}
            <TouchableOpacity 
              style={[styles.captureButton, isCapturing && styles.captureButtonPressed]}
              onPress={takePicture}
              disabled={isCapturing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            {/* Flip Camera Button */}
            <TouchableOpacity style={styles.sideButton} onPress={flipCamera}>
              <Ionicons name="camera-reverse" size={32} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Sizes.xl,
  },
  permissionTitle: {
    fontSize: Sizes.fontXl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Sizes.lg,
    marginBottom: Sizes.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: Sizes.fontMd,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Sizes.xl,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Sizes.xl,
    paddingVertical: Sizes.md,
    borderRadius: Sizes.radiusMd,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: Sizes.fontMd,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.lg,
    paddingTop: Sizes.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Sizes.xl,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Sizes.xl,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonPressed: {
    transform: [{ scale: 0.9 }],
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  sideButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
