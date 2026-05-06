# CloudShare

Cloud-native coursework project that implements an Asset/Multimedia sharing API and frontend on Azure.

## Overview

This repository contains:
- A serverless backend using Azure Functions (Node.js + TypeScript)
- A static frontend hosted on Azure Web App
- Azure Blob Storage for media files
- Azure Cosmos DB (NoSQL) for asset metadata
- Azure Logic App workflow integration
- Monitoring with Application Insights + Log Analytics
- Infrastructure as Code with Bicep
- CI/CD with GitHub Actions

## Tech Stack

- Node.js 20+
- TypeScript
- Azure Functions v4 programming model
- Azure Blob Storage SDK
- Azure Cosmos DB SDK
- Vitest + ESLint
- Bicep

## Repository Structure

```text
.
|- .github/workflows/azure-cicd.yml
|- infra/main.bicep
|- src/
|  |- functions/assetsApi.ts
|  |- services/assetRepository.ts
|  |- services/blobStorage.ts
|  |- lib/http.ts
|- frontend/
|  |- index.html
|  |- app.js
|- logic-apps/assets-crud-workflow.json
|- tests/http.test.ts
|- host.json
|- package.json
```

## API Endpoints

Base URL (deployed): `https://cloudshareapiasbin2.azurewebsites.net/api/assets`

- `GET /api/assets` -> list assets
- `GET /api/assets/{id}` -> get asset by ID
- `POST /api/assets` -> create asset
- `PUT /api/assets/{id}` -> update asset
- `DELETE /api/assets/{id}` -> delete asset

## Prerequisites

- Node.js 20 or later
- npm
- Azure CLI (`az`)
- Azure Functions Core Tools (`func`) for local run
- Azure subscription (for deployment)

## Local Development

1. Install dependencies:
```bash
npm ci
```

2. Build:
```bash
npm run build
```

3. Quality checks:
```bash
npm run lint
npm run typecheck
npm test
```

4. Configure local settings:
- Create/update `local.settings.json`
- Required app settings:
  - `AzureWebJobsStorage`
  - `STORAGE_CONNECTION_STRING`
  - `STORAGE_CONTAINER`
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `COSMOS_DATABASE`
  - `COSMOS_CONTAINER`

5. Start Functions host:
```bash
func start
```

## Infrastructure Deployment (Manual)

Deploy Azure resources using Bicep:

```bash
az deployment group create \
  --resource-group <resource-group-name> \
  --template-file infra/main.bicep \
  --parameters projectName=cloudshare functionAppName=<function-app-name> frontendAppName=<frontend-app-name>
```

## CI/CD Pipeline

Workflow file: `.github/workflows/azure-cicd.yml`

Pipeline stages:
- **quality**: install, lint, typecheck, test, build
- **deploy** (main branch only): deploy infra + function package + frontend zip

Required GitHub repository secrets:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_FUNCTION_APP_NAME`
- `AZURE_FRONTEND_APP_NAME`

## Outputs

After successful deployment, main URLs are:
- Function App: `https://cloudshareapiasbin2.azurewebsites.net`
- Frontend App (Live): `https://cloudsharewebasbin2.azurewebsites.net`

## Notes

- `local.settings.json` is ignored and must not be committed.
- Zip artifacts are ignored by `.gitignore`.
