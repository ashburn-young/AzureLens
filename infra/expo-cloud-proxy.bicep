targetScope = 'resourceGroup'

@description('The name of the environment')
param environmentName string

@description('The location for the resources')
param location string

@description('The resource token for unique naming')
param resourceToken string

@description('Backend API URL to proxy to')
param backendApiUrl string

@description('Container Apps Environment ID')
param containerAppsEnvironmentId string

@description('Container Registry Name')
param containerRegistryName string

@description('User Assigned Identity ID')
param userAssignedIdentityId string

@description('Tags to apply to all resources')
param tags object = {}

var proxyAppName = 'ca-expo-proxy-${resourceToken}'

// Container App for Expo Cloud Proxy
resource expoProxyApp 'Microsoft.App/containerApps@2024-03-01' = {  name: proxyAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'expo-proxy'
    'azd-env-name': environmentName
    purpose: 'expo-development-proxy'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        allowInsecure: false
        transport: 'Http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
          allowedHeaders: ['*']
          allowCredentials: false
        }
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          identity: userAssignedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          image: '${containerRegistryName}.azurecr.io/azure-lens/expo-proxy:latest'
          name: 'expo-proxy'
          env: [
            {
              name: 'BACKEND_API_URL'
              value: backendApiUrl
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3001
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3001
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// Outputs
output EXPO_PROXY_URL string = 'https://${expoProxyApp.properties.configuration.ingress.fqdn}'
output EXPO_PROXY_APP_NAME string = expoProxyApp.name
output EXPO_PROXY_FQDN string = expoProxyApp.properties.configuration.ingress.fqdn
