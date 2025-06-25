/**
 * Azure Computer Vision API v3.2 supported features (current backend)
 * These correspond to the visualFeatures parameter in the Azure Computer Vision API
 */
export const VISION_FEATURES = {
  // Main analysis features (v3.2 format)
  CATEGORIES: 'Categories',
  DESCRIPTION: 'Description', 
  OBJECTS: 'Objects',
  FACES: 'Faces',
  TAGS: 'Tags',
  READ: 'Read',
} as const;

/**
 * Default features for general image analysis (v3.2 compatible)
 */
export const DEFAULT_ANALYSIS_FEATURES = [
  VISION_FEATURES.DESCRIPTION,
  VISION_FEATURES.OBJECTS,
  VISION_FEATURES.TAGS,
  VISION_FEATURES.CATEGORIES,
];

/**
 * Features for OCR/text extraction
 */
export const OCR_FEATURES = [
  VISION_FEATURES.READ,
];

/**
 * All available features
 */
export const ALL_FEATURES = Object.values(VISION_FEATURES);
