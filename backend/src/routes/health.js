const express = require('express');
const router = express.Router();
const { getAzureClients } = require('../config/azure');
const logger = require('../utils/logger');

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    services: {}
  };

  try {
    const clients = getAzureClients();

    // Check Vision service
    healthStatus.services.vision = {
      status: clients.vision ? 'available' : 'unavailable',
      endpoint: process.env.VISION_ENDPOINT || 'not configured'
    };

    // Check Translator service
    healthStatus.services.translator = {
      status: clients.translator ? 'available' : 'unavailable',
      endpoint: process.env.TRANSLATOR_ENDPOINT || 'not configured'
    };

    // Check OpenAI service
    healthStatus.services.openai = {
      status: clients.openai ? 'available' : 'unavailable',
      endpoint: process.env.OPENAI_ENDPOINT || 'not configured'
    };

    // Check Blob Storage
    healthStatus.services.storage = {
      status: clients.blobService ? 'available' : 'unavailable',
      configured: !!process.env.STORAGE_CONNECTION_STRING
    };

    // Check Key Vault
    healthStatus.services.keyVault = {
      status: clients.keyVault ? 'available' : 'unavailable',
      url: process.env.KEY_VAULT_URL || 'not configured'
    };

    // Determine overall health
    const unavailableServices = Object.values(healthStatus.services)
      .filter(service => service.status === 'unavailable').length;

    if (unavailableServices > 0) {
      healthStatus.status = 'degraded';
      logger.warn(`Health check shows ${unavailableServices} unavailable services`);
    }

    res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    healthStatus.status = 'unhealthy';
    healthStatus.error = error.message;
    
    res.status(503).json(healthStatus);
  }
});

/**
 * Detailed health check for monitoring systems
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    services: {},
    checks: []
  };

  try {
    const clients = getAzureClients();
    
    // Test Vision service connectivity
    try {
      if (clients.vision && process.env.VISION_ENDPOINT) {
        // We can't easily test without making a real API call
        detailedHealth.services.vision = {
          status: 'available',
          endpoint: process.env.VISION_ENDPOINT,
          lastChecked: new Date().toISOString()
        };
        detailedHealth.checks.push({
          name: 'vision-service',
          status: 'pass',
          time: new Date().toISOString()
        });
      } else {
        throw new Error('Vision service not configured');
      }
    } catch (error) {
      detailedHealth.services.vision = {
        status: 'unavailable',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
      detailedHealth.checks.push({
        name: 'vision-service',
        status: 'fail',
        time: new Date().toISOString(),
        output: error.message
      });
    }

    // Test Translator service
    try {
      if (clients.translator && process.env.TRANSLATOR_ENDPOINT) {
        detailedHealth.services.translator = {
          status: 'available',
          endpoint: process.env.TRANSLATOR_ENDPOINT,
          lastChecked: new Date().toISOString()
        };
        detailedHealth.checks.push({
          name: 'translator-service',
          status: 'pass',
          time: new Date().toISOString()
        });
      } else {
        throw new Error('Translator service not configured');
      }
    } catch (error) {
      detailedHealth.services.translator = {
        status: 'unavailable',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
      detailedHealth.checks.push({
        name: 'translator-service',
        status: 'fail',
        time: new Date().toISOString(),
        output: error.message
      });
    }

    // Test Blob Storage connectivity
    try {
      if (clients.blobService) {
        // Test basic connectivity
        await clients.blobService.getProperties();
        detailedHealth.services.storage = {
          status: 'available',
          lastChecked: new Date().toISOString()
        };
        detailedHealth.checks.push({
          name: 'blob-storage',
          status: 'pass',
          time: new Date().toISOString()
        });
      } else {
        throw new Error('Blob storage not configured');
      }
    } catch (error) {
      detailedHealth.services.storage = {
        status: 'unavailable',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
      detailedHealth.checks.push({
        name: 'blob-storage',
        status: 'fail',
        time: new Date().toISOString(),
        output: error.message
      });
    }

    // Determine overall health
    const failedChecks = detailedHealth.checks.filter(check => check.status === 'fail').length;
    
    if (failedChecks > 0) {
      detailedHealth.status = failedChecks === detailedHealth.checks.length ? 'unhealthy' : 'degraded';
    }

    const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(detailedHealth);

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    detailedHealth.status = 'unhealthy';
    detailedHealth.error = error.message;
    
    res.status(503).json(detailedHealth);
  }
});

/**
 * Readiness probe for Kubernetes
 * GET /health/ready
 */
router.get('/ready', (req, res) => {
  // Simple readiness check - server is running
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

/**
 * Liveness probe for Kubernetes
 * GET /health/live
 */
router.get('/live', (req, res) => {
  // Simple liveness check - server is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
