const express = require('express');
const router = express.Router();
const { getAzureClients, azureConfig } = require('../config/azure');
const logger = require('../utils/logger');
const { validateImageAnalysisRequest } = require('../middleware/validation');
const { uploadImageToBlob } = require('../services/storageService');
const EnhancedVisionService = require('../services/enhancedVisionService');
const axios = require('axios');

/**
 * Analyze image with Azure AI Vision v4.0 REST API
 * POST /api/vision/analyze
 */
router.post('/analyze', async (req, res) => {
  try {
    let imageBuffer;
    let features;
    let language;

    // Handle both multipart/form-data (legacy) and JSON (new base64 format)
    if (req.file) {
      // Legacy multipart upload
      imageBuffer = req.file.buffer;
      features = req.body.features ? req.body.features.split(',') : ['Caption', 'Objects', 'Tags', 'People'];
      language = req.body.language || 'en';
    } else if (req.body.image) {
      // New base64 format
      try {
        imageBuffer = Buffer.from(req.body.image, 'base64');
        features = req.body.features ? req.body.features.split(',') : ['Caption', 'Objects', 'Tags', 'People'];
        language = req.body.language || 'en';
      } catch (decodeError) {
        return res.status(400).json({ 
          error: 'Invalid image data',
          message: 'Failed to decode base64 image data' 
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'No image data provided',
        message: 'Please provide image data either as multipart file or base64 string' 
      });
    }

    logger.info('Starting image analysis', { 
      fileSize: imageBuffer.length, 
      encoding: req.file ? 'multipart' : 'base64',
      mimetype: req.file?.mimetype || 'image/jpeg',
      features: features 
    });

    // Validate image buffer
    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid image data',
        message: 'Image buffer is empty or corrupted' 
      });
    }

    if (imageBuffer.length > 20 * 1024 * 1024) { // 20MB
      return res.status(400).json({ 
        error: 'Image too large',
        message: `Image size (${Math.round(imageBuffer.length / 1024)}KB) exceeds the 20MB limit` 
      });
    }

    // Build the v4.0 API URL with features as query parameters
    const visionEndpoint = process.env.VISION_ENDPOINT;
    const visionApiKey = process.env.VISION_API_KEY;
    
    if (!visionEndpoint || !visionApiKey) {
      return res.status(503).json({ 
        error: 'Vision service unavailable',
        message: 'Azure Vision service is not configured' 
      });
    }

    const apiUrl = `${visionEndpoint}/computervision/imageanalysis:analyze`;
    const apiVersion = '2024-02-01';
    
    // Map features to v4.0 API format
    const featureParams = features.join(',');
    
    const params = new URLSearchParams({
      'api-version': apiVersion,
      features: featureParams,
      language: language
    });

    logger.info('Making v4.0 API request', { 
      url: `${apiUrl}?${params.toString()}`,
      features: featureParams,
      bufferSize: imageBuffer.length,
      contentType: 'application/octet-stream'
    });

    // Make the REST API call to v4.0
    const response = await axios.post(
      `${apiUrl}?${params.toString()}`,
      imageBuffer,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': visionApiKey,
          'Content-Type': 'application/octet-stream'
        },
        timeout: 30000
      }
    );

    const result = response.data;
    
    // Log the full result structure for debugging
    logger.info('Vision API v4.0 result structure:', { 
      resultKeys: Object.keys(result),
      resultData: process.env.NODE_ENV === 'development' ? result : 'hidden in production'
    });

    // Upload image to blob storage for caching (optional)
    let imageUrl = null;
    try {
      imageUrl = await uploadImageToBlob(imageBuffer, req.file.originalname);
      logger.info('Image uploaded to blob storage', { imageUrl });
    } catch (uploadError) {
      logger.warn('Failed to upload image to blob storage', uploadError);
    }

    // Process and format the response for v4.0 API
    const analysisResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      imageUrl,
      analysis: {
        // Caption from v4.0 API
        caption: result.captionResult?.text || null,
        confidence: result.captionResult?.confidence || null,
        
        // Dense captions (v4.0 feature)
        denseCaptions: result.denseCaptionsResult?.values?.map(cap => ({
          text: cap.text,
          confidence: cap.confidence,
          boundingBox: cap.boundingBox
        })) || [],
        
        // Objects from v4.0 API
        objects: result.objectsResult?.values?.map(obj => ({
          name: obj.tags?.[0]?.name || obj.name,
          confidence: obj.tags?.[0]?.confidence || obj.confidence,
          boundingBox: obj.boundingBox
        })) || [],
        
        // People from v4.0 API
        people: result.peopleResult?.values?.map(person => ({
          confidence: person.confidence,
          boundingBox: person.boundingBox
        })) || [],
        
        // Tags from v4.0 API
        tags: result.tagsResult?.values?.map(tag => ({
          name: tag.name,
          confidence: tag.confidence
        })) || [],
        
        // Smart crops (v4.0 feature)
        smartCrops: result.smartCropsResult?.values?.map(crop => ({
          aspectRatio: crop.aspectRatio,
          boundingBox: crop.boundingBox
        })) || [],
        
        // OCR/Read results
        text: result.readResult?.blocks?.flatMap(block => 
          block.lines.map(line => line.text)
        ).join('\n') || null
      }
    };

    logger.info('Image analysis completed successfully');
    res.json(analysisResponse);

  } catch (error) {
    logger.error('Image analysis failed:', error);
    
    // Handle specific Azure API errors
    if (error.response) {
      logger.error('Azure API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      return res.status(error.response.status).json({ 
        error: 'Analysis failed',
        message: error.response.data?.error?.message || 'Failed to analyze the image. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.response.data : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Analysis failed',
      message: 'Failed to analyze the image. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Extract text from image (OCR) using v4.0 REST API
 * POST /api/vision/ocr
 */
router.post('/ocr', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No image file provided',
        message: 'Please upload an image file' 
      });
    }

    const imageBuffer = req.file.buffer;
    const language = req.body.language || 'en';
    
    logger.info('Starting OCR analysis', { fileSize: imageBuffer.length });

    // Build the v4.0 API URL for OCR
    const visionEndpoint = process.env.VISION_ENDPOINT;
    const visionApiKey = process.env.VISION_API_KEY;
    
    if (!visionEndpoint || !visionApiKey) {
      return res.status(503).json({ 
        error: 'Vision service unavailable',
        message: 'Azure Vision service is not configured' 
      });
    }

    const apiUrl = `${visionEndpoint}/computervision/imageanalysis:analyze`;
    const apiVersion = '2024-02-01';
    
    const params = new URLSearchParams({
      'api-version': apiVersion,
      features: 'Read',
      language: language
    });

    // Make the REST API call to v4.0
    const response = await axios.post(
      `${apiUrl}?${params.toString()}`,
      imageBuffer,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': visionApiKey,
          'Content-Type': 'application/octet-stream'
        },
        timeout: 30000
      }
    );

    const result = response.data;

    // Extract text from the v4.0 result
    const extractedText = result.readResult?.blocks?.flatMap(block => 
      block.lines.map(line => line.text)
    ).join('\n') || '';

    const detailedText = result.readResult?.blocks?.flatMap(block => 
      block.lines.map(line => ({
        text: line.text,
        boundingBox: line.boundingBox,
        words: line.words?.map(word => ({
          text: word.text,
          boundingBox: word.boundingBox,
          confidence: word.confidence
        })) || []
      }))
    ) || [];

    const ocrResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      text: extractedText,
      detailedText,
      language: language,
      wordCount: extractedText.split(/\s+/).length
    };

    logger.info('OCR analysis completed successfully', { 
      textLength: extractedText.length,
      wordCount: ocrResponse.wordCount 
    });
    
    res.json(ocrResponse);

  } catch (error) {
    logger.error('OCR analysis failed:', error);
    
    // Handle specific Azure API errors
    if (error.response) {
      logger.error('Azure API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      return res.status(error.response.status).json({ 
        error: 'OCR failed',
        message: error.response.data?.error?.message || 'Failed to extract text from the image. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.response.data : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'OCR failed',
      message: 'Failed to extract text from the image. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Enhanced image analysis with GPT-4o
 * POST /api/vision/analyze-enhanced
 */
router.post('/analyze-enhanced', async (req, res) => {
  try {
    let imageBuffer;
    let mimeType = 'image/jpeg';

    // Handle both multipart/form-data and JSON base64 format
    if (req.file) {
      imageBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/jpeg';
    } else if (req.body.image) {
      try {
        imageBuffer = Buffer.from(req.body.image, 'base64');
        mimeType = req.body.mimeType || 'image/jpeg';
      } catch (decodeError) {
        return res.status(400).json({ 
          error: 'Invalid image data',
          message: 'Failed to decode base64 image data' 
        });
      }
    } else {
      return res.status(400).json({ 
        error: 'No image data provided',
        message: 'Please provide image data either as multipart file or base64 string' 
      });
    }

    // Validate image
    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid image data',
        message: 'Image buffer is empty or corrupted' 
      });
    }

    if (imageBuffer.length > 20 * 1024 * 1024) { // 20MB
      return res.status(400).json({ 
        error: 'Image too large',
        message: `Image size (${Math.round(imageBuffer.length / 1024)}KB) exceeds the 20MB limit` 
      });
    }

    logger.info('Starting enhanced image analysis with GPT-4o', { 
      fileSize: imageBuffer.length,
      mimeType: mimeType
    });

    // Use enhanced vision service
    const enhancedVisionService = new EnhancedVisionService();
    const analysisResult = await enhancedVisionService.analyzeImageWithGPT4o(imageBuffer, mimeType);

    // Upload to blob storage (optional, based on configuration)
    let blobUrl = null;
    try {
      if (process.env.STORAGE_CONNECTION_STRING) {
        blobUrl = await uploadImageToBlob(imageBuffer, mimeType);
        logger.info('Image uploaded to blob storage', { blobUrl });
      }
    } catch (uploadError) {
      logger.warn('Failed to upload to blob storage:', uploadError.message);
    }

    // Return enhanced analysis
    const result = {
      ...analysisResult,
      blobUrl,
      timestamp: new Date().toISOString(),
      processing: {
        model: 'gpt-4o',
        enhanced: true,
        processingTimeMs: Date.now() - req.startTime
      }
    };

    logger.info('Enhanced image analysis completed', {
      model: result.processing.model,
      tokensUsed: result.usage?.total_tokens,
      confidence: result.analysis?.confidence,
      processingTime: result.processing.processingTimeMs
    });

    res.status(200).json(result);

  } catch (error) {
    logger.error('Enhanced image analysis failed:', error);

    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        error: 'Service quota exceeded',
        message: 'AI service quota exceeded. Please try again later.',
        retryAfter: 60
      });
    }

    if (error.message.includes('content filtered')) {
      return res.status(400).json({
        error: 'Content filtered',
        message: 'The image was filtered by content policy. Please try a different image.'
      });
    }

    res.status(500).json({
      error: 'Enhanced analysis failed',
      message: error.message || 'An unexpected error occurred during enhanced image analysis'
    });
  }
});

/**
 * Get supported visual features
 * GET /api/vision/features
 */
router.get('/features', (req, res) => {
  res.json({
    supportedFeatures: azureConfig.vision.visualFeatures,
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
  });
});

module.exports = router;
