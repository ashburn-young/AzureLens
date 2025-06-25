const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation middleware for image analysis requests
 */
const validateImageAnalysisRequest = (req, res, next) => {
  // Schema for query parameters and body
  const schema = Joi.object({
    features: Joi.string().optional().custom((value, helpers) => {
      const validFeatures = [
        'Caption', 'DenseCaptions', 'Objects', 'People', 
        'Read', 'SmartCrops', 'Tags'
      ];
      const requestedFeatures = value.split(',').map(f => f.trim());
      const invalidFeatures = requestedFeatures.filter(f => !validFeatures.includes(f));
      
      if (invalidFeatures.length > 0) {
        return helpers.error('any.invalid', { 
          value: invalidFeatures.join(', '),
          validFeatures: validFeatures.join(', ')
        });
      }
      
      return value;
    }),
    language: Joi.string().optional().valid(
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'
    ),
    genderNeutralCaption: Joi.boolean().optional()
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn('Image analysis validation failed:', error.details);
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      validFeatures: [
        'Caption', 'DenseCaptions', 'Objects', 'People', 
        'Read', 'SmartCrops', 'Tags'
      ]
    });
  }

  // Validate file
  if (req.file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        message: 'Image file must be smaller than 10MB'
      });
    }
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only JPEG, PNG, GIF, BMP, and WebP images are allowed'
      });
    }
  }

  next();
};

/**
 * Validation middleware for translation requests
 */
const validateTranslationRequest = (req, res, next) => {
  const schema = Joi.object({
    text: Joi.string().required().min(1).max(10000),
    targetLanguage: Joi.string().required().valid(
      'ar', 'zh', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'it', 
      'ja', 'ko', 'pt', 'ru', 'es', 'th', 'tr', 'vi'
    ),
    sourceLanguage: Joi.string().optional().valid(
      'auto', 'ar', 'zh', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'it', 
      'ja', 'ko', 'pt', 'ru', 'es', 'th', 'tr', 'vi'
    )
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn('Translation validation failed:', error.details);
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      supportedLanguages: [
        'ar', 'zh', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'it', 
        'ja', 'ko', 'pt', 'ru', 'es', 'th', 'tr', 'vi'
      ]
    });
  }

  next();
};

/**
 * Validation middleware for batch translation requests
 */
const validateBatchTranslationRequest = (req, res, next) => {
  const schema = Joi.object({
    texts: Joi.array().items(
      Joi.string().min(1).max(10000)
    ).required().min(1).max(100),
    targetLanguage: Joi.string().required().valid(
      'ar', 'zh', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'it', 
      'ja', 'ko', 'pt', 'ru', 'es', 'th', 'tr', 'vi'
    ),
    sourceLanguage: Joi.string().optional().valid(
      'auto', 'ar', 'zh', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'it', 
      'ja', 'ko', 'pt', 'ru', 'es', 'th', 'tr', 'vi'
    )
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn('Batch translation validation failed:', error.details);
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message,
      limits: {
        maxTexts: 100,
        maxTextLength: 10000
      }
    });
  }

  next();
};

/**
 * Validation middleware for language detection requests
 */
const validateLanguageDetectionRequest = (req, res, next) => {
  const schema = Joi.object({
    text: Joi.string().required().min(1).max(10000)
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn('Language detection validation failed:', error.details);
    return res.status(400).json({
      error: 'Validation failed',
      message: error.details[0].message
    });
  }

  next();
};

/**
 * Generic validation middleware factory
 */
const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      logger.warn('Validation failed:', error.details);
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0].message
      });
    }

    next();
  };
};

module.exports = {
  validateImageAnalysisRequest,
  validateTranslationRequest,
  validateBatchTranslationRequest,
  validateLanguageDetectionRequest,
  createValidationMiddleware
};
