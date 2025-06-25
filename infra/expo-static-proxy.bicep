targetScope = 'resourceGroup'

@description('The name of the environment')
param environmentName string

@description('The location for the resources')
param location string

@description('The resource token for unique naming')
param resourceToken string

@description('Backend API URL to proxy to')
param backendApiUrl string

@description('Tags to apply to all resources')
param tags object = {}

// Static Web App for Expo Development Proxy
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'swa-expo-proxy-${resourceToken}'
  location: location
  tags: union(tags, {
    purpose: 'expo-development-proxy'
  })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/your-username/azure-lens-expo-proxy'
    branch: 'main'
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'build'
    }
    stagingEnvironmentPolicy: 'Enabled'
  }
}

// Configuration for the Static Web App
resource staticWebAppConfig 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    BACKEND_API_URL: backendApiUrl
    NODE_ENV: 'production'
    EXPO_PROXY_MODE: 'true'
  }
}

// Output the Static Web App URL
output EXPO_PROXY_URL string = 'https://${staticWebApp.properties.defaultHostname}'
output STATIC_WEB_APP_NAME string = staticWebApp.name
output STATIC_WEB_APP_RESOURCE_ID string = staticWebApp.id
