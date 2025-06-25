const express = require('express');
const router = express.Router();
const { getAzureClients, azureConfig } = require('../config/azure');
const logger = require('../utils/logger');
const { validateTranslationRequest } = require('../middleware/validation');

/**
 * Translate text
 * POST /api/translation/translate
 */
router.post('/translate', validateTranslationRequest, async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Both text and targetLanguage are required' 
      });
    }

    const { translator } = getAzureClients();
    if (!translator) {
      return res.status(503).json({ 
        error: 'Translation service unavailable',
        message: 'Azure Translator service is not configured' 
      });
    }

    logger.info('Starting translation', { 
      textLength: text.length, 
      targetLanguage,
      sourceLanguage: sourceLanguage || 'auto-detect'
    });    const translateOptions = {
      body: [{ text }],
      to: [targetLanguage]
    };

    if (sourceLanguage && sourceLanguage !== 'auto') {
      translateOptions.from = sourceLanguage;
    }    // Perform translation
    const result = await translator.path("/translate").post(translateOptions);
    
    logger.info('Translation API response:', {
      status: result.status,
      body: result.body,
      headers: result.headers
    });

    if (!result.body || result.body.length === 0) {
      throw new Error('No translation result received');
    }

    const translation = result.body[0];
    
    logger.info('Processing translation result:', {
      translation: translation,
      hasTranslations: !!translation.translations,
      hasText: !!translation.text
    });
    
    // Handle different possible response structures
    const translatedText = translation.translations?.[0]?.text || 
                          translation.text || 
                          'Translation not available';
    
    const detectedLang = translation.detectedLanguage?.language || sourceLanguage || 'unknown';
    const confidence = translation.detectedLanguage?.score || null;
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      originalText: text,
      translatedText,
      sourceLanguage: detectedLang,
      targetLanguage,
      confidence,
      alternatives: translation.translations?.slice(1)?.map(t => t.text) || []
    };

    logger.info('Translation completed successfully', { 
      sourceLanguage: response.sourceLanguage,
      targetLanguage: response.targetLanguage
    });
    
    res.json(response);
  } catch (error) {
    logger.error('Translation failed:', error);
    logger.error('Translation error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data || 'No response data'
    });
    res.status(500).json({ 
      error: 'Translation failed',
      message: 'Failed to translate the text. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Detect language of text
 * POST /api/translation/detect
 */
router.post('/detect', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ 
        error: 'Missing text parameter',
        message: 'Text is required for language detection' 
      });
    }

    const { translator } = getAzureClients();
    if (!translator) {
      return res.status(503).json({ 
        error: 'Translation service unavailable',
        message: 'Azure Translator service is not configured' 
      });
    }

    logger.info('Starting language detection', { textLength: text.length });

    // Perform language detection
    const result = await translator.translate([{ text }], { 
      to: ['en'], // We need to specify a target language for detection
      textType: 'plain'
    });

    if (!result || result.length === 0) {
      throw new Error('No detection result received');
    }

    const detection = result[0].detectedLanguage;
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      text,
      detectedLanguage: detection.language,
      confidence: detection.score,
      languageName: getLanguageName(detection.language)
    };

    logger.info('Language detection completed successfully', { 
      detectedLanguage: response.detectedLanguage,
      confidence: response.confidence
    });
    
    res.json(response);

  } catch (error) {
    logger.error('Language detection failed:', error);
    res.status(500).json({ 
      error: 'Detection failed',
      message: 'Failed to detect the language. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get supported languages
 * GET /api/translation/languages
 */
router.get('/languages', (req, res) => {
  const supportedLanguages = {
    'ar': 'Arabic',
    'zh': 'Chinese (Simplified)',
    'zh-Hant': 'Chinese (Traditional)',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'hi': 'Hindi',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'es': 'Spanish',
    'th': 'Thai',
    'tr': 'Turkish',
    'vi': 'Vietnamese'
  };

  res.json({
    supportedLanguages,
    defaultTargetLanguage: azureConfig.translator.defaultTargetLanguage,
    autoDetectionSupported: true
  });
});

/**
 * Batch translate multiple texts
 * POST /api/translation/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { texts, targetLanguage, sourceLanguage } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid texts parameter',
        message: 'An array of texts is required' 
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({ 
        error: 'Missing targetLanguage parameter',
        message: 'Target language is required' 
      });
    }

    if (texts.length > 100) {
      return res.status(400).json({ 
        error: 'Too many texts',
        message: 'Maximum 100 texts allowed per batch request' 
      });
    }

    const { translator } = getAzureClients();
    if (!translator) {
      return res.status(503).json({ 
        error: 'Translation service unavailable',
        message: 'Azure Translator service is not configured' 
      });
    }

    logger.info('Starting batch translation', { 
      textCount: texts.length, 
      targetLanguage,
      sourceLanguage: sourceLanguage || 'auto-detect'
    });

    const translateOptions = {
      to: [targetLanguage],
      textType: 'plain'
    };

    if (sourceLanguage && sourceLanguage !== 'auto') {
      translateOptions.from = sourceLanguage;
    }

    // Prepare texts for translation
    const textInputs = texts.map(text => ({ text }));

    // Perform batch translation
    const results = await translator.translate(textInputs, translateOptions);

    const translations = results.map((result, index) => ({
      originalText: texts[index],
      translatedText: result.translations[0].text,
      sourceLanguage: result.detectedLanguage?.language || sourceLanguage || 'unknown',
      confidence: result.detectedLanguage?.score || null
    }));

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      targetLanguage,
      translations,
      totalCount: translations.length
    };

    logger.info('Batch translation completed successfully', { 
      translationCount: translations.length 
    });
    
    res.json(response);

  } catch (error) {
    logger.error('Batch translation failed:', error);
    res.status(500).json({ 
      error: 'Batch translation failed',
      message: 'Failed to translate the texts. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Helper function to get language name from code
 */
function getLanguageName(languageCode) {
  const languages = {
    'ar': 'Arabic',
    'zh': 'Chinese (Simplified)',
    'zh-Hant': 'Chinese (Traditional)',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'hi': 'Hindi',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'es': 'Spanish',
    'th': 'Thai',
    'tr': 'Turkish',
    'vi': 'Vietnamese'
  };

  return languages[languageCode] || languageCode;
}

/**
 * Get supported languages
 * GET /api/translation/languages
 */
router.get('/languages', async (req, res) => {
  try {
    const { translator } = getAzureClients();
    if (!translator) {
      return res.status(503).json({ 
        error: 'Translation service unavailable',
        message: 'Azure Translator service is not configured' 
      });
    }

    // Get supported languages
    const result = await translator.path("/languages").get();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      languages: result.body
    });

  } catch (error) {
    logger.error('Failed to get supported languages:', error);
    res.status(500).json({ 
      error: 'Failed to get languages',
      message: 'Failed to retrieve supported languages. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
