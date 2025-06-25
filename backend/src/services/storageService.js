const { getAzureClients, azureConfig } = require('../config/azure');
const logger = require('../utils/logger');
const crypto = require('crypto');
const path = require('path');

/**
 * Upload image to Azure Blob Storage
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} originalName - Original filename
 * @returns {Promise<string>} - Blob URL
 */
async function uploadImageToBlob(imageBuffer, originalName) {
  try {
    const { blobService } = getAzureClients();
    
    if (!blobService) {
      throw new Error('Blob storage service not available');
    }

    const containerName = azureConfig.storage.containerName || 'images';
    
    // Ensure container exists
    const containerClient = blobService.getContainerClient(containerName);
    await containerClient.createIfNotExists({
      access: 'blob' // Public read access for images
    });

    // Generate unique blob name
    const fileExtension = path.extname(originalName) || '.jpg';
    const timestamp = new Date().getTime();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const blobName = `${timestamp}-${randomSuffix}${fileExtension}`;

    // Upload blob
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Determine content type
    const contentType = getContentType(fileExtension);
    
    await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType
      },
      metadata: {
        originalName: originalName,
        uploadedAt: new Date().toISOString(),
        source: 'azure-lens-api'
      }
    });

    logger.info('Image uploaded to blob storage', { 
      blobName, 
      size: imageBuffer.length,
      contentType 
    });

    return blockBlobClient.url;

  } catch (error) {
    logger.error('Failed to upload image to blob storage:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Download image from Azure Blob Storage
 * @param {string} blobUrl - Blob URL
 * @returns {Promise<Buffer>} - Image buffer
 */
async function downloadImageFromBlob(blobUrl) {
  try {
    const { blobService } = getAzureClients();
    
    if (!blobService) {
      throw new Error('Blob storage service not available');
    }

    // Extract container and blob name from URL
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/');
    const containerName = pathParts[1];
    const blobName = pathParts.slice(2).join('/');

    const containerClient = blobService.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const downloadResponse = await blockBlobClient.download();
    const downloadedContent = await streamToBuffer(downloadResponse.readableStreamBody);

    logger.info('Image downloaded from blob storage', { 
      blobName, 
      size: downloadedContent.length 
    });

    return downloadedContent;

  } catch (error) {
    logger.error('Failed to download image from blob storage:', error);
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Delete image from Azure Blob Storage
 * @param {string} blobUrl - Blob URL
 * @returns {Promise<boolean>} - Success status
 */
async function deleteImageFromBlob(blobUrl) {
  try {
    const { blobService } = getAzureClients();
    
    if (!blobService) {
      throw new Error('Blob storage service not available');
    }

    // Extract container and blob name from URL
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/');
    const containerName = pathParts[1];
    const blobName = pathParts.slice(2).join('/');

    const containerClient = blobService.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();

    logger.info('Image deleted from blob storage', { blobName });
    return true;

  } catch (error) {
    logger.error('Failed to delete image from blob storage:', error);
    return false;
  }
}

/**
 * List images in blob storage
 * @param {string} containerName - Container name
 * @param {string} prefix - Blob name prefix (optional)
 * @returns {Promise<Array>} - List of blob info
 */
async function listImagesInBlob(containerName = null, prefix = '') {
  try {
    const { blobService } = getAzureClients();
    
    if (!blobService) {
      throw new Error('Blob storage service not available');
    }

    const actualContainerName = containerName || azureConfig.storage.containerName || 'images';
    const containerClient = blobService.getContainerClient(actualContainerName);

    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobs.push({
        name: blob.name,
        url: `${containerClient.url}/${blob.name}`,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType,
        metadata: blob.metadata
      });
    }

    logger.info('Listed images from blob storage', { 
      container: actualContainerName, 
      count: blobs.length,
      prefix 
    });

    return blobs;

  } catch (error) {
    logger.error('Failed to list images from blob storage:', error);
    throw new Error(`Failed to list images: ${error.message}`);
  }
}

/**
 * Get blob storage usage statistics
 * @returns {Promise<Object>} - Storage statistics
 */
async function getStorageStats() {
  try {
    const { blobService } = getAzureClients();
    
    if (!blobService) {
      throw new Error('Blob storage service not available');
    }

    const containerName = azureConfig.storage.containerName || 'images';
    const containerClient = blobService.getContainerClient(containerName);

    let totalSize = 0;
    let blobCount = 0;
    const contentTypes = {};

    for await (const blob of containerClient.listBlobsFlat()) {
      totalSize += blob.properties.contentLength || 0;
      blobCount++;
      
      const contentType = blob.properties.contentType || 'unknown';
      contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;
    }

    const stats = {
      containerName,
      totalBlobs: blobCount,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      contentTypes,
      lastChecked: new Date().toISOString()
    };

    logger.info('Retrieved storage statistics', stats);
    return stats;

  } catch (error) {
    logger.error('Failed to get storage statistics:', error);
    throw new Error(`Failed to get storage stats: ${error.message}`);
  }
}

/**
 * Helper function to convert stream to buffer
 * @param {ReadableStream} readableStream 
 * @returns {Promise<Buffer>}
 */
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

/**
 * Get content type from file extension
 * @param {string} extension 
 * @returns {string}
 */
function getContentType(extension) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.svg': 'image/svg+xml'
  };

  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  uploadImageToBlob,
  downloadImageFromBlob,
  deleteImageFromBlob,
  listImagesInBlob,
  getStorageStats
};
