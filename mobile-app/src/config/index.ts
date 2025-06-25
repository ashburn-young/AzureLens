// App configuration constants
export const Config = {
  API: {
    BASE_URL: process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3000' : 'https://ca-mtggirvui4fj2.gentleglacier-7102d185.swedencentral.azurecontainerapps.io'),
    TIMEOUT: 30000,
    MAX_RETRIES: 3,
  },
  
  CAMERA: {
    QUALITY: 0.8,
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080,
    ALLOW_EDITING: true,
  },
  
  STORAGE: {
    HISTORY_KEY: '@azure_lens_history',
    SETTINGS_KEY: '@azure_lens_settings',
    MAX_HISTORY_ITEMS: 100,
  },
  
  FEATURES: {
    OFFLINE_MODE: __DEV__ ? false : true,
    ANALYTICS: !__DEV__,
    CRASH_REPORTING: !__DEV__,
  },
  
  APP: {
    NAME: 'Azure Lens',
    VERSION: '1.0.0',
    SUPPORT_EMAIL: 'support@azurelens.com',
    PRIVACY_URL: 'https://azurelens.com/privacy',
    TERMS_URL: 'https://azurelens.com/terms',
  },
} as const;

export type ConfigType = typeof Config;
