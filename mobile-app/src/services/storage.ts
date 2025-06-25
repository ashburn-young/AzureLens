import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config';
import { AnalysisResult, OCRResult, TranslationResult } from '../types';

export interface HistoryItem {
  id: string;
  timestamp: Date;
  imageUri: string;
  mode: string;
  analysisResult?: AnalysisResult;
  ocrResult?: OCRResult;
  translationResult?: TranslationResult;
}

export interface UserSettings {
  defaultLanguage: string;
  enableHaptics: boolean;
  enableAnalytics: boolean;
  theme: 'light' | 'dark' | 'auto';
  cameraFlashMode: 'auto' | 'on' | 'off';
  saveToPhotos: boolean;
}

class StorageService {
  private static instance: StorageService;

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // History Management
  async getHistory(): Promise<HistoryItem[]> {
    try {
      const historyData = await AsyncStorage.getItem(Config.STORAGE.HISTORY_KEY);
      if (historyData) {
        const history = JSON.parse(historyData);
        return history.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
      return [];
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }

  async addHistoryItem(item: Omit<HistoryItem, 'id' | 'timestamp'>): Promise<void> {
    try {
      const history = await this.getHistory();
      const newItem: HistoryItem = {
        ...item,
        id: Date.now().toString(),
        timestamp: new Date(),
      };

      const updatedHistory = [newItem, ...history].slice(0, Config.STORAGE.MAX_HISTORY_ITEMS);
      await AsyncStorage.setItem(Config.STORAGE.HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error adding history item:', error);
    }
  }

  async removeHistoryItem(id: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const updatedHistory = history.filter(item => item.id !== id);
      await AsyncStorage.setItem(Config.STORAGE.HISTORY_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error removing history item:', error);
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(Config.STORAGE.HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  // Settings Management
  async getSettings(): Promise<UserSettings> {
    try {
      const settingsData = await AsyncStorage.getItem(Config.STORAGE.SETTINGS_KEY);
      if (settingsData) {
        return JSON.parse(settingsData);
      }
      
      // Return default settings
      return {
        defaultLanguage: 'en',
        enableHaptics: true,
        enableAnalytics: true,
        theme: 'auto',
        cameraFlashMode: 'auto',
        saveToPhotos: false,
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        defaultLanguage: 'en',
        enableHaptics: true,
        enableAnalytics: true,
        theme: 'auto',
        cameraFlashMode: 'auto',
        saveToPhotos: false,
      };
    }
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(Config.STORAGE.SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }

  // Cache Management
  async getCacheSize(): Promise<number> {
    try {
      // Calculate approximate cache size
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length * 2; // Rough estimate (UTF-16)
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }

  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((key: string) => key.startsWith('@azure_lens_'));
      await AsyncStorage.multiRemove(appKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export const storageService = StorageService.getInstance();
