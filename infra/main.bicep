targetScope = 'resourceGroup'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Resource token to create unique resource names')
param resourceToken string = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))

@description('Storage account name suffix to ensure uniqueness')
var storageAccountSuffix = take(replace(resourceToken, '-', ''), 20)
var storageAccountName = take('st${storageAccountSuffix}${uniqueString(environmentName)}', 24)

@description('Tags that will be applied to all resources')
param tags object = {
  'azd-env-name': environmentName
}

// Define the names for the Azure resources
var resourceNames = {
  cognitiveServicesVision: 'cog-vision-${resourceToken}'
  cognitiveServicesTranslator: 'cog-translator-${resourceToken}'
  cognitiveServicesOpenAI: 'cog-openai-${resourceToken}'
  storageAccount: storageAccountName
  cosmosDbAccount: 'cosmos-${resourceToken}'
  containerAppsEnvironment: 'cae-${resourceToken}'
  containerApp: 'ca-${resourceToken}'
  containerRegistry: 'acr${take(replace(resourceToken, '-', ''), 47)}'
  logAnalyticsWorkspace: 'log-${resourceToken}'
  keyVault: take('kv-${replace(resourceToken, '-', '')}', 24)
  userAssignedIdentity: 'id-${resourceToken}'
  resourceGroup: 'rg-${environmentName}'
}

// User Assigned Managed Identity
resource userIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: resourceNames.userAssignedIdentity
  location: location
  tags: tags
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: resourceNames.logAnalyticsWorkspace
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      searchVersion: 1
      legacy: 0
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// Container Apps Environment
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: resourceNames.containerAppsEnvironment
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Storage Account for images and blob storage
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: resourceNames.storageAccount
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    dnsEndpointType: 'Standard'
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: false
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

// Azure AI Vision Service
resource cognitiveServicesVision 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: resourceNames.cognitiveServicesVision
  location: location
  tags: tags
  sku: {
    name: 'S1'
  }
  kind: 'ComputerVision'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userIdentity.id}': {}
    }
  }
  properties: {
    apiProperties: {}
    customSubDomainName: resourceNames.cognitiveServicesVision
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
  }
}

// Azure AI Translator Service
resource cognitiveServicesTranslator 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: resourceNames.cognitiveServicesTranslator
  location: location
  tags: tags
  sku: {
    name: 'S1'
  }
  kind: 'TextTranslation'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userIdentity.id}': {}
    }
  }
  properties: {
    apiProperties: {}
    customSubDomainName: resourceNames.cognitiveServicesTranslator
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
  }
}

// Azure OpenAI Service
resource cognitiveServicesOpenAI 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: resourceNames.cognitiveServicesOpenAI
  location: location
  tags: tags
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userIdentity.id}': {}
    }
  }
  properties: {
    apiProperties: {}
    customSubDomainName: resourceNames.cognitiveServicesOpenAI
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
  }
}

// Key Vault for secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: resourceNames.keyVault
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: userIdentity.properties.principalId
        permissions: {
          keys: ['get']
          secrets: ['get', 'list']
          certificates: ['get']
        }
      }
    ]
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enableRbacAuthorization: false
    publicNetworkAccess: 'Enabled'
  }
}

// Container App for API backend
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: resourceNames.containerApp
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: userIdentity.id
        }
      ]
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          allowCredentials: false
        }
      }
      secrets: [        {
          name: 'vision-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/vision-api-key'
          identity: userIdentity.id
        }
        {
          name: 'translator-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/translator-api-key'
          identity: userIdentity.id
        }
        {
          name: 'openai-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/openai-api-key'
          identity: userIdentity.id
        }
        {
          name: 'storage-connection-string'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/storage-connection-string'
          identity: userIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          name: 'azure-lens-api'
          resources: {
            cpu: 1
            memory: '2.0Gi'
          }
          env: [
            {
              name: 'VISION_ENDPOINT'
              value: cognitiveServicesVision.properties.endpoint
            }
            {
              name: 'VISION_API_KEY'
              secretRef: 'vision-api-key'
            }
            {
              name: 'TRANSLATOR_ENDPOINT'
              value: cognitiveServicesTranslator.properties.endpoint
            }
            {
              name: 'TRANSLATOR_API_KEY'
              secretRef: 'translator-api-key'
            }
            {
              name: 'OPENAI_ENDPOINT'
              value: cognitiveServicesOpenAI.properties.endpoint
            }
            {
              name: 'OPENAI_API_KEY'
              secretRef: 'openai-api-key'
            }
            {
              name: 'STORAGE_CONNECTION_STRING'
              secretRef: 'storage-connection-string'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: userIdentity.properties.clientId
            }
            {
              name: 'KEY_VAULT_URL'
              value: keyVault.properties.vaultUri
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPullRole
  ]
}

// Azure Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: replace(resourceNames.containerRegistry, '-', '')
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

// Role assignment to allow Container App to pull from ACR
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, userIdentity.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: userIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Store API keys in Key Vault
resource visionApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'vision-api-key'
  properties: {
    value: cognitiveServicesVision.listKeys().key1
  }
}

resource translatorApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'translator-api-key'
  properties: {
    value: cognitiveServicesTranslator.listKeys().key1
  }
}

resource openaiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'openai-api-key'
  properties: {
    value: cognitiveServicesOpenAI.listKeys().key1
  }
}

resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
  }
}

// Expo Cloud Proxy Module
module expoCloudProxy 'expo-cloud-proxy.bicep' = {
  name: 'expoCloudProxy'
  params: {
    environmentName: environmentName
    location: location
    resourceToken: resourceToken
    backendApiUrl: 'https://${containerApp.properties.configuration.ingress.fqdn}'
    containerAppsEnvironmentId: containerAppsEnvironment.id
    containerRegistryName: containerRegistry.name
    userAssignedIdentityId: userIdentity.id
    tags: tags
  }
}

// Outputs
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = subscription().tenantId
output AZURE_RESOURCE_GROUP string = resourceGroup().name
output RESOURCE_GROUP_ID string = resourceGroup().id

output SERVICE_API_IDENTITY_PRINCIPAL_ID string = userIdentity.properties.principalId
output SERVICE_API_NAME string = containerApp.name
output SERVICE_API_URI string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output SERVICE_API_IMAGE_NAME string = 'azure-lens-api'

output AZURE_STORAGE_ACCOUNT_NAME string = storageAccount.name
output AZURE_STORAGE_ACCOUNT_ENDPOINT string = storageAccount.properties.primaryEndpoints.blob

output AZURE_VISION_ENDPOINT string = cognitiveServicesVision.properties.endpoint
output AZURE_TRANSLATOR_ENDPOINT string = cognitiveServicesTranslator.properties.endpoint
output AZURE_OPENAI_ENDPOINT string = cognitiveServicesOpenAI.properties.endpoint

output AZURE_KEY_VAULT_NAME string = keyVault.name
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.properties.vaultUri

output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.name

// Expo Cloud Proxy Outputs
output EXPO_PROXY_URL string = expoCloudProxy.outputs.EXPO_PROXY_URL
output EXPO_PROXY_APP_NAME string = expoCloudProxy.outputs.EXPO_PROXY_APP_NAME
output EXPO_PROXY_FQDN string = expoCloudProxy.outputs.EXPO_PROXY_FQDN
