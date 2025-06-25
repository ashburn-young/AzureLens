const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error
  let error = {
    status: 500,
    message: 'Internal server error'
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = {
      status: 400,
      message: 'Validation error',
      details: err.details
    };
  } else if (err.name === 'CastError') {
    error = {
      status: 400,
      message: 'Invalid ID format'
    };
  } else if (err.code === 11000) {
    error = {
      status: 409,
      message: 'Duplicate field value'
    };
  } else if (err.name === 'JsonWebTokenError') {
    error = {
      status: 401,
      message: 'Invalid token'
    };
  } else if (err.name === 'TokenExpiredError') {
    error = {
      status: 401,
      message: 'Token expired'
    };
  } else if (err.type === 'entity.parse.failed') {
    error = {
      status: 400,
      message: 'Invalid JSON payload'
    };
  } else if (err.type === 'entity.too.large') {
    error = {
      status: 413,
      message: 'Payload too large'
    };
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      status: 413,
      message: 'File too large'
    };
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      status: 400,
      message: 'Unexpected file field'
    };
  }

  // Handle Azure service errors
  if (err.code) {
    switch (err.code) {
      case 'Unauthorized':
        error = {
          status: 401,
          message: 'Azure service authentication failed'
        };
        break;
      case 'Forbidden':
        error = {
          status: 403,
          message: 'Azure service access denied'
        };
        break;
      case 'NotFound':
        error = {
          status: 404,
          message: 'Azure resource not found'
        };
        break;
      case 'TooManyRequests':
        error = {
          status: 429,
          message: 'Azure service rate limit exceeded'
        };
        break;
      case 'ServiceUnavailable':
        error = {
          status: 503,
          message: 'Azure service temporarily unavailable'
        };
        break;
    }
  }

  // Handle network/timeout errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    error = {
      status: 503,
      message: 'Service temporarily unavailable'
    };
  }

  // Don't expose internal error details in production
  const response = {
    error: error.message,
    status: error.status,
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = error.details || err.message;
  }

  // Include request ID if available
  if (req.id) {
    response.requestId = req.id;
  }

  res.status(error.status).json(response);
};

/**
 * Handle 404 errors for undefined routes
 */
const notFoundHandler = (req, res) => {
  const error = {
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    status: 404,
    timestamp: new Date().toISOString()
  };

  logger.warn('404 error:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json(error);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
