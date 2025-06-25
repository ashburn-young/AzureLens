export interface AnalysisResult {
  success: boolean;
  timestamp: string;
  imageUrl?: string;
  enhanced?: boolean;
  data?: any; // For enhanced analysis results
  analysis: {
    caption?: string;
    confidence?: number;
    categories: Category[];
    objects: DetectedObject[];
    people: Person[];
    tags: Tag[];
  };
}

export interface OCRResult {
  success: boolean;
  timestamp: string;
  text: string;
  detailedText: DetailedText[];
  language: string;
  wordCount: number;
}

export interface TranslationResult {
  success: boolean;
  timestamp: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
  alternatives: string[];
}

export interface Category {
  name: string;
  confidence: number;
}

export interface DetectedObject {
  name: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface Person {
  age?: number;
  gender?: string;
  boundingBox: BoundingBox;
}

export interface Tag {
  name: string;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetailedText {
  text: string;
  boundingBox: number[];
  words: Word[];
}

export interface Word {
  text: string;
  boundingBox: number[];
  confidence: number;
}

export interface ScanHistoryItem {
  id: string;
  type: 'vision' | 'ocr' | 'translation';
  timestamp: string;
  imageUri?: string;
  result: AnalysisResult | OCRResult | TranslationResult;
  title: string;
  subtitle?: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: string;
}

export interface CameraPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

export interface ImagePickerResult {
  uri: string;
  width: number;
  height: number;
  type?: string;
}

export type ScanMode = 'auto' | 'text' | 'translate' | 'analyze';

export interface AppSettings {
  defaultLanguage: string;
  autoTranslate: boolean;
  saveToHistory: boolean;
  hapticFeedback: boolean;
  soundEnabled: boolean;
  cameraFlash: boolean;
}
