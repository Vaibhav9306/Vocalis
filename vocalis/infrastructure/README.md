# Infrastructure & Cloud Provisioning

This directory manages cloud resource definitions, infrastructure-as-code (IaC), and deployment manifests for the AI Meeting Assistant.

## Current State (Phase 1)
- No resources have been created or modified in this phase.
- Existing Azure resources were inspected:
  - Azure OpenAI account: `ai-meeting-assistant` (`eastus`, SKU `S0`)
  - AI Services: `spotifyfree1221-0114-resource` (`westus3`), `ai-meeting-assistant-5g-resource` (`eastus2`)
  - Monitoring: `ai-meeting-assistant-5g-resource-logs`, `ai-meeting-assistant-5g-resource-appinsights`

## Planned State (Phase 2 & Beyond)
- Azure Bicep / ARM templates for automated infrastructure deployment.
- Azure Key Vault configuration for secure credential storage in production.
- Model deployment scripts for Azure OpenAI (`whisper`, `gpt-4o-mini` / `gpt-5-mini`).
