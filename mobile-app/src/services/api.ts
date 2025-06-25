import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AnalysisResult, OCRResult, TranslationResult, ApiError } from '../types';
import { Config } from '../config';

// Use our deployed Azure Container Apps endpoint
const API_BASE_URL = Config.API.BASE_URL;

export class AzureLensApiService {
  private api: AxiosInstance;
  private static readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
  private static readonly MAX_DIMENSION = 4096; // Maximum width/height
  private static readonly COMPRESSION_QUALITY = 0.8; // 80% quality

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: Config.API.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ API Response Error:', error);
        const apiError: ApiError = {
          error: error.response?.data?.error || 'Network Error',
          message: error.response?.data?.message || 'Something went wrong',
          details: error.response?.data?.details || error.message,
        };
        return Promise.reject(apiError);
      }
    );
  }

  /**
   * Validate image and ensure it's properly formatted
   */
  private async processImage(imageUri: string): Promise<string> {
    try {
      console.log(`🔍 Processing image: ${imageUri}`);
      
      // Check if the URI is valid
      if (!imageUri || typeof imageUri !== 'string') {
        throw new Error('Invalid image URI provided');
      }

      // Fetch the image and check if it's accessible
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const fileSize = blob.size;

      console.log(`📊 Image info: Size: ${Math.round(fileSize / 1024)}KB, Type: ${blob.type}`);

      // Validate file size
      if (fileSize === 0) {
        throw new Error('Image file is empty or corrupted. Please try taking a new photo.');
      }

      if (fileSize > AzureLensApiService.MAX_FILE_SIZE) {
        console.warn(`⚠️  Image is large (${Math.round(fileSize / 1024)}KB). May cause upload issues.`);
      }

      // Check if it looks like an image (basic validation)
      if (blob.type && !blob.type.startsWith('image/')) {
        throw new Error('The selected file is not a valid image. Please choose an image file.');
      }

      console.log('✅ Image validation completed successfully');
      return imageUri;
    } catch (error) {
      console.error('❌ Image validation failed:', error);
      
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Failed to process image. Please try again with a different image.');
      }
    }
  }

  /**
   * Check API health status
   */
  async checkHealth(): Promise<any> {
    try {
      const response = await this.api.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get API information
   */
  async getApiInfo(): Promise<any> {
    try {
      const response = await this.api.get('/');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get supported vision features
   */
  async getVisionFeatures(): Promise<any> {
    try {
      const response = await this.api.get('/api/vision/features');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Analyze image using Azure Computer Vision
   */
  async analyzeImage(
    imageUri: string,
    features?: string[],
    language?: string
  ): Promise<AnalysisResult> {
    try {
      // Process the image (validate and compress if needed)
      const processedImageUri = await this.processImage(imageUri);
      
      console.log(`🔍 Converting image to base64 for upload...`);
      
      // Convert image to base64 to avoid blob encoding issues
      const response = await fetch(processedImageUri);
      const blob = await response.blob();
      
      // Convert blob to base64
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const base64Data = await base64Promise;
      
      console.log(`📤 Uploading image as base64: ${Math.round(base64Data.length * 0.75 / 1024)}KB estimated size`);
      
      const requestBody = {
        image: base64Data,
        features: features?.join(',') || 'Caption,Objects,Tags,People',
        language: language || 'en'
      };

      const apiResponse = await this.api.post('/api/vision/analyze', requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return apiResponse.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract text from image using OCR
   */
  async extractText(imageUri: string, language?: string): Promise<OCRResult> {
    try {
      // Process the image (validate and compress if needed)
      const processedImageUri = await this.processImage(imageUri);
      
      const formData = new FormData();
      
      // Convert processed image URI to blob
      const response = await fetch(processedImageUri);
      const blob = await response.blob();
      
      console.log(`📤 Uploading image for OCR: ${Math.round(blob.size / 1024)}KB`);
      
      formData.append('image', blob as any, 'image.jpg');
      
      if (language) {
        formData.append('language', language);
      }

      const apiResponse = await this.api.post('/api/vision/ocr', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return apiResponse.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get supported translation languages
   */
  async getTranslationLanguages(): Promise<any> {
    try {
      const response = await this.api.get('/api/translation/languages');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Translate text
   */
  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    try {
      const response = await this.api.post('/api/translation/translate', {
        text,
        targetLanguage,
        sourceLanguage,
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<any> {
    try {
      const response = await this.api.post('/api/translation/detect', {
        text,
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Enhanced image analysis using GPT-4o
   * Provides more detailed, conversational analysis
   */
  async analyzeImageEnhanced(imageUri: string): Promise<AnalysisResult> {
    try {
      const validImageUri = await this.processImage(imageUri);
      
      console.log('🚀 Starting enhanced image analysis with GPT-4o...');
      
      // Get image data and convert to base64 using FileReader (React Native compatible)
      const response = await fetch(validImageUri);
      const blob = await response.blob();
      
      // Convert blob to base64 using FileReader (React Native compatible)
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const base64 = await base64Promise;
      
      const analysisResponse = await this.api.post('/api/vision/analyze-enhanced', {
        image: base64,
        mimeType: blob.type || 'image/jpeg'
      });

      const result = analysisResponse.data;
      
      console.log('✅ Enhanced analysis completed:', {
        model: result.processing?.model,
        tokensUsed: result.usage?.total_tokens,
        confidence: result.analysis?.confidence
      });

      return {
        success: true,
        enhanced: true,
        data: result,
        analysis: {
          caption: result.analysis?.summary || result.analysis?.description,
          confidence: result.analysis?.confidence || 0.9,
          categories: result.analysis?.categories || [],
          objects: result.analysis?.objects || [],
          people: result.analysis?.people || [],
          tags: result.analysis?.tags || []
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Enhanced image analysis failed:', error);
      
      if (error instanceof Error && error.message.includes('quota exceeded')) {
        throw new Error('AI service quota exceeded. Please try again later.');
      }
      
      // Fallback to standard analysis if enhanced fails
      console.log('🔄 Falling back to standard analysis...');
      return this.analyzeImage(imageUri);
    }
  }
}

// Export singleton instance
export const apiService = new AzureLensApiService();
