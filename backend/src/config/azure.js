const { DefaultAzureCredential } = require('@azure/identity');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const TextTranslationClient = require('@azure-rest/ai-translation-text').default;
const OpenAI = require('openai');
const { BlobServiceClient } = require('@azure/storage-blob');
const { SecretClient } = require('@azure/keyvault-secrets');
const logger = require('../utils/logger');

// Global Azure clients
let azureClients = {};

/**
 * Initialize Azure clients with managed identity authentication
 */
async function initializeAzureClients() {
  try {
    logger.info('Initializing Azure clients...');
    
    // Use managed identity for authentication
    const credential = new DefaultAzureCredential();
      // Initialize Vision client
    if (process.env.VISION_ENDPOINT && process.env.VISION_API_KEY) {
      const visionCredentials = new ApiKeyCredentials({ 
        inHeader: { 'Ocp-Apim-Subscription-Key': process.env.VISION_API_KEY } 
      });
      azureClients.vision = new ComputerVisionClient(
        visionCredentials, 
        process.env.VISION_ENDPOINT
      );
      logger.info('Vision client initialized');
    }
    
    // Initialize Translator client
    if (process.env.TRANSLATOR_API_KEY) {
      azureClients.translator = TextTranslationClient({
        key: process.env.TRANSLATOR_API_KEY,
        region: process.env.TRANSLATOR_REGION || 'global'
      });
      logger.info('Translator client initialized');
    }
    
    // Initialize OpenAI client
    if (process.env.OPENAI_ENDPOINT && process.env.OPENAI_API_KEY) {
      azureClients.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: `${process.env.OPENAI_ENDPOINT}/openai/deployments/${process.env.OPENAI_DEPLOYMENT_NAME}`,
        defaultQuery: { 'api-version': '2024-02-01' },
        defaultHeaders: {
          'api-key': process.env.OPENAI_API_KEY,
        },
      });
      logger.info('OpenAI client initialized');
    }
    
    // Initialize Blob Storage client
    if (process.env.STORAGE_CONNECTION_STRING) {
      azureClients.blobService = BlobServiceClient.fromConnectionString(
        process.env.STORAGE_CONNECTION_STRING
      );
      logger.info('Blob Storage client initialized');
    }
    
    // Initialize Key Vault client
    if (process.env.KEY_VAULT_URL) {
      azureClients.keyVault = new SecretClient(
        process.env.KEY_VAULT_URL,
        credential
      );
      logger.info('Key Vault client initialized');
    }
    
    logger.info('All Azure clients initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Azure clients:', error);
    throw error;
  }
}

/**
 * Get Azure client instances
 */
function getAzureClients() {
  return azureClients;
}

/**
 * Configuration for Azure AI services
 */
const azureConfig = {
  vision: {
    visualFeatures: [
      'Caption',
      'DenseCaptions', 
      'Objects',
      'People',
      'Read',
      'SmartCrops',
      'Tags'
    ],
    genderNeutralCaption: true,
    language: 'en'
  },
  
  translator: {
    defaultTargetLanguage: 'en',
    supportedLanguages: [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
    ]
  },
  
  openai: {
    deploymentName: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.7,
    // Enhanced vision capabilities
    visionEnabled: true,
    maxImageSize: 20 * 1024 * 1024, // 20MB
    supportedImageFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp']
  },
  
  storage: {
    containerName: 'images',
    maxRetries: 3,
    retryDelayMs: 1000
  }
};

module.exports = {
  initializeAzureClients,
  getAzureClients,
  azureConfig
};
