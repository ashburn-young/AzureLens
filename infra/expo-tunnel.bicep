// Azure Container Instance to host Expo Development Server with Tunnel
// This solves network connectivity issues by hosting the Expo server on Azure

param environmentName string = 'dev'
param location string = resourceGroup().location
param resourceToken string = uniqueString(subscription().id, resourceGroup().id, environmentName)

// Create a simple Container Instance to run an ngrok-like tunnel
resource expoDevelopmentTunnel 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: 'ci-expo-tunnel-${resourceToken}'
  location: location
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    containers: [
      {
        name: 'expo-tunnel'
        properties: {
          image: 'cloudflare/cloudflared:latest'
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
          ports: [
            {
              port: 8080
              protocol: 'TCP'
            }
          ]
          command: [
            'cloudflared'
            'tunnel'
            '--url'
            'http://host.docker.internal:8081'
            '--no-autoupdate'
          ]
          environmentVariables: [
            {
              name: 'TUNNEL_ORIGIN_CERT'
              value: '/dev/null'
            }
          ]
        }
      }
    ]
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Public'
      ports: [
        {
          port: 8080
          protocol: 'TCP'
        }
      ]
      dnsNameLabel: 'expo-tunnel-${resourceToken}'
    }
  }
}

// Output the tunnel URL
output EXPO_TUNNEL_URL string = 'https://${expoDevelopmentTunnel.properties.ipAddress.fqdn}:8080'
output EXPO_TUNNEL_FQDN string = expoDevelopmentTunnel.properties.ipAddress.fqdn
