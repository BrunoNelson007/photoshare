# Scalable CW 2 - Azure Deployment Guide

This guide walks you through deploying the PhotoShare application to Azure using **free tier services only**.

## Prerequisites

1. **Azure Account** with free tier subscription
2. **Auth0 Account** (free tier: 7,000 MAU)
3. **Azure CLI** installed (`az --version`)
4. **Node.js 18+** and pnpm
5. **Git** installed

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Static Web Apps                        │
│                  (Next.js Frontend + API Routes)                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Cosmos DB    │ │  Blob Storage │ │    Auth0      │
│  (Database)   │ │   (Photos)    │ │    (Auth)     │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │
        ▼                 ▼
┌───────────────┐ ┌───────────────┐
│Computer Vision│ │Content Safety │
│  (AI Tags)    │ │ (Moderation)  │
└───────────────┘ └───────────────┘
```

## Free Tier Limits

| Service | Free Tier Limit |
|---------|-----------------|
| Static Web Apps | 100GB bandwidth/month, 2 custom domains |
| Cosmos DB | 25GB storage, 1000 RU/s |
| Blob Storage | 5GB LRS, 20K read/write ops |
| Computer Vision | 5000 transactions/month |
| Content Safety | 5000 transactions/month |
| Auth0 | 7,000 Monthly Active Users |

---

## Step 1: Create Resource Group

```bash
# Login to Azure
az login

# Set subscription (use free tier if available)
az account set --subscription "Your Subscription Name"

# Create resource group
az group create \
  --name rg-photoshare \
  --location eastus
```

---

## Step 2: Set Up Auth0 (Authentication)

Auth0 provides a much simpler setup than Azure AD B2C with a generous free tier.

### 2.1 Create Auth0 Account

1. Go to [https://auth0.com](https://auth0.com) and sign up
2. Create a new tenant (e.g., `photoshare`)

### 2.2 Create Application

1. Go to **Applications > Applications**
2. Click **Create Application**
3. Choose **Regular Web Applications**
4. Name it: `PhotoShare Web App`

### 2.3 Configure Application Settings

In your application settings:

**Allowed Callback URLs:**
```
http://localhost:3000/api/auth/callback/auth0,
https://your-app.azurestaticapps.net/api/auth/callback/auth0
```

**Allowed Logout URLs:**
```
http://localhost:3000,
https://your-app.azurestaticapps.net
```

**Allowed Web Origins:**
```
http://localhost:3000,
https://your-app.azurestaticapps.net
```

### 2.4 Note Your Credentials

From the **Settings** tab, copy:
- **Domain** (e.g., `your-tenant.auth0.com`)
- **Client ID**
- **Client Secret**

### 2.5 (Optional) Add Role-Based Access

To support Creator/Consumer roles:

1. Go to **User Management > Roles**
2. Create two roles: `creator` and `consumer`
3. Go to **Actions > Flows > Login**
4. Create a custom action to add roles to tokens:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://photoshare.app';
  const roles = event.authorization?.roles || [];
  
  api.idToken.setCustomClaim(`${namespace}/roles`, roles);
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
};
```

---

## Step 3: Create Cosmos DB Account

```bash
# Create Cosmos DB account (serverless for free tier optimization)
az cosmosdb create \
  --name cosmos-photoshare \
  --resource-group rg-photoshare \
  --kind GlobalDocumentDB \
  --default-consistency-level Session \
  --locations regionName=eastus failoverPriority=0 isZoneRedundant=False \
  --capabilities EnableServerless

# Create database
az cosmosdb sql database create \
  --account-name cosmos-photoshare \
  --resource-group rg-photoshare \
  --name photoshare

# Create containers
az cosmosdb sql container create \
  --account-name cosmos-photoshare \
  --resource-group rg-photoshare \
  --database-name photoshare \
  --name photos \
  --partition-key-path /creatorId

az cosmosdb sql container create \
  --account-name cosmos-photoshare \
  --resource-group rg-photoshare \
  --database-name photoshare \
  --name comments \
  --partition-key-path /photoId

az cosmosdb sql container create \
  --account-name cosmos-photoshare \
  --resource-group rg-photoshare \
  --database-name photoshare \
  --name ratings \
  --partition-key-path /photoId

az cosmosdb sql container create \
  --account-name cosmos-photoshare \
  --resource-group rg-photoshare \
  --database-name photoshare \
  --name users \
  --partition-key-path /id

az cosmosdb sql container create \
  --account-name cosmos-photoshare \
  --resource-group rg-photoshare \
  --database-name photoshare \
  --name rate_limits \
  --partition-key-path /id \
  --default-ttl 3600

# Get connection details
az cosmosdb keys list \
  --name cosmos-photoshare \
  --resource-group rg-photoshare \
  --type keys
```

---

## Step 4: Create Storage Account

```bash
# Create storage account (use unique name)
STORAGE_NAME="stphotoshare$(date +%s | tail -c 6)"
az storage account create \
  --name $STORAGE_NAME \
  --resource-group rg-photoshare \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2

# Create blob container
az storage container create \
  --name photos \
  --account-name $STORAGE_NAME \
  --public-access off

# Get connection string
az storage account show-connection-string \
  --name $STORAGE_NAME \
  --resource-group rg-photoshare

echo "Storage account name: $STORAGE_NAME"
```

---

## Step 5: Create Computer Vision Resource

```bash
# Create Computer Vision resource
az cognitiveservices account create \
  --name cv-photoshare \
  --resource-group rg-photoshare \
  --kind ComputerVision \
  --sku F0 \
  --location eastus \
  --yes

# Get endpoint and keys
az cognitiveservices account show \
  --name cv-photoshare \
  --resource-group rg-photoshare \
  --query properties.endpoint

az cognitiveservices account keys list \
  --name cv-photoshare \
  --resource-group rg-photoshare
```

---

## Step 6: Create Content Safety Resource

```bash
# Create Content Safety resource
az cognitiveservices account create \
  --name cs-photoshare \
  --resource-group rg-photoshare \
  --kind ContentSafety \
  --sku F0 \
  --location eastus \
  --yes

# Get endpoint and keys
az cognitiveservices account show \
  --name cs-photoshare \
  --resource-group rg-photoshare \
  --query properties.endpoint

az cognitiveservices account keys list \
  --name cs-photoshare \
  --resource-group rg-photoshare
```

---

## Step 7: Local Testing

### 7.1 Configure Environment

```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your credentials
```

### 7.2 Run Locally

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Visit `http://localhost:3000` to test:
- Auth0 login
- Demo credentials login (works without Azure)
- Photo upload (requires Azure storage)
- AI tagging (requires Computer Vision)

---

## Step 8: Deploy to Azure Static Web Apps

### 8.1 Create Static Web App

```bash
# Create Static Web App
az staticwebapp create \
  --name swa-photoshare \
  --resource-group rg-photoshare \
  --location eastus2 \
  --sku Free
```

### 8.2 Configure Environment Variables

In Azure Portal > Static Web Apps > Configuration > Application settings:

```
# Auth0
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com

# NextAuth
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-app.azurestaticapps.net

# Cosmos DB
AZURE_COSMOS_ENDPOINT=https://cosmos-photoshare.documents.azure.com:443/
AZURE_COSMOS_KEY=<your-cosmos-key>
AZURE_COSMOS_DATABASE=photoshare

# Blob Storage
AZURE_STORAGE_CONNECTION_STRING=<your-storage-connection-string>
AZURE_STORAGE_ACCOUNT_NAME=<your-storage-account>
AZURE_STORAGE_CONTAINER_NAME=photos

# Computer Vision
AZURE_VISION_ENDPOINT=https://eastus.api.cognitive.microsoft.com/
AZURE_VISION_KEY=<your-vision-key>

# Content Safety
AZURE_CONTENT_SAFETY_ENDPOINT=https://eastus.cognitiveservices.azure.com/
AZURE_CONTENT_SAFETY_KEY=<your-content-safety-key>
```

### 8.3 Deploy via GitHub Actions

1. Push your code to GitHub
2. In Azure Portal, go to Static Web Apps > Deployment
3. Connect your GitHub repository
4. Azure creates a workflow automatically

Or deploy manually:

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Build
pnpm build

# Deploy
swa deploy .next --env production
```

---

## Step 9: Configure CORS

### Blob Storage CORS

```bash
az storage cors add \
  --services b \
  --methods GET PUT \
  --origins "http://localhost:3000" "https://your-app.azurestaticapps.net" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name <storage-account-name>
```

---

## Step 10: Verify Deployment

### Test Checklist

1. **Authentication**
   - [ ] Auth0 login works
   - [ ] Demo credentials work
   - [ ] Session persists

2. **Creator Features**
   - [ ] Dashboard loads stats
   - [ ] Photo upload works
   - [ ] AI tags generated
   - [ ] Content moderation active

3. **Consumer Features**
   - [ ] Photo feed loads
   - [ ] Search works
   - [ ] Comments can be added
   - [ ] Ratings can be submitted

4. **Security**
   - [ ] Rate limiting active
   - [ ] Protected routes redirect
   - [ ] CORS configured

---

## Troubleshooting

### Auth0 Issues

**"Callback URL mismatch"**
- Verify the callback URL in Auth0 matches exactly
- Include both localhost and production URLs

**"Invalid token"**
- Check AUTH0_ISSUER_BASE_URL includes `https://`
- Verify client ID and secret are correct

### Azure Issues

**"401 Unauthorized" on API calls**
- Check NEXTAUTH_SECRET is set
- Verify AUTH0 credentials

**"CORS Error"**
- Run the CORS configuration command
- Check CSP headers in next.config.mjs

**"Rate limit exceeded"**
- Check rate_limits container in Cosmos DB
- Adjust RATE_LIMIT_* env vars

### AI Features Not Working

**"Computer Vision error"**
- Verify AZURE_VISION_KEY and ENDPOINT
- Check free tier limit (5000/month)

**"Content Safety error"**
- Verify AZURE_CONTENT_SAFETY_KEY and ENDPOINT
- Check free tier limit (5000/month)

---

## Security Checklist

- [ ] All secrets in environment variables (never in code)
- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Content moderation active
- [ ] Input validation on all API endpoints
- [ ] JWT tokens validated on protected routes
- [ ] CSP headers configured

---

## Cost Optimization

1. **Cosmos DB Serverless** - Pay only for operations used
2. **Blob Storage Lifecycle** - Auto-delete old uploads
3. **Monitor AI Usage** - Stay within free tier limits
4. **Static Web Apps Free** - Sufficient for most apps

---

## Getting Help

- Auth0 Documentation: https://auth0.com/docs
- Azure Static Web Apps: https://docs.microsoft.com/azure/static-web-apps
- Cosmos DB: https://docs.microsoft.com/azure/cosmos-db
- Next.js: https://nextjs.org/docs
