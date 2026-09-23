# AI Meeting Assistant - Automated Azure App Service Deployment Script
# Prerequisites: Azure CLI ('az') logged in with an active subscription

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$AppName = "",

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroup = "ai-meeting-rg",

    [Parameter(Mandatory = $false)]
    [string]$Location = "centralindia",

    [Parameter(Mandatory = $false)]
    [string]$PlanName = "asp-vocalis-centralindia",

    [Parameter(Mandatory = $false)]
    [string]$Sku = "B1",

    [Parameter(Mandatory = $false)]
    [switch]$ConfirmDeployment
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Vocalis AI Meeting Assistant - Azure B1 Deployment     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Azure CLI Authentication & Active Subscription
Write-Host "`n[1/7] Verifying Azure CLI authentication..." -ForegroundColor Yellow
try {
    $accountRaw = az account show --output json 2>$null
    if (-not $accountRaw) {
        throw "Not logged in"
    }
    $account = $accountRaw | ConvertFrom-Json
} catch {
    Write-Error "Azure CLI is not logged in. Please run 'az login' and select your subscription before continuing."
    exit 1
}

$subName = $account.name
$subId = $account.id
Write-Host "Authenticated as: $($account.user.name)" -ForegroundColor Green
Write-Host "Active Subscription: $subName ($subId)" -ForegroundColor Green

# 2. Inspect Existing Azure AI / OpenAI Resources (Do NOT create new ones)
Write-Host "`n[2/7] Inspecting existing Azure Cognitive & AI Services in $ResourceGroup..." -ForegroundColor Yellow

# Inspect dedicated OpenAI resource: ai-meeting-assistant (eastus)
$openAiAccountName = "ai-meeting-assistant"
$openAiAccount = az cognitiveservices account show -n $openAiAccountName -g $ResourceGroup -o json 2>$null | ConvertFrom-Json
$openAiDeployments = @(az cognitiveservices account deployment list -n $openAiAccountName -g $ResourceGroup --query "[].name" -o tsv 2>$null)

Write-Host "OpenAI Resource:       $openAiAccountName (Kind: $($openAiAccount.kind), Region: $($openAiAccount.location))" -ForegroundColor Cyan
Write-Host "  Endpoint:            $($openAiAccount.properties.endpoint)" -ForegroundColor Gray
Write-Host "  Model Deployments:   $(if ($openAiDeployments.Count -gt 0) { $openAiDeployments -join ', ' } else { 'None (0 deployed)' })" -ForegroundColor $(if ($openAiDeployments.Count -gt 0) { 'Green' } else { 'DarkYellow' })

# Inspect multi-service AI resource: ai-meeting-assistant-5g-resource (eastus2)
$aiServicesAccountName = "ai-meeting-assistant-5g-resource"
$aiServicesAccount = az cognitiveservices account show -n $aiServicesAccountName -g $ResourceGroup -o json 2>$null | ConvertFrom-Json
$aiServicesDeployments = @(az cognitiveservices account deployment list -n $aiServicesAccountName -g $ResourceGroup --query "[].name" -o tsv 2>$null)

Write-Host "AI Services Resource:  $aiServicesAccountName (Kind: $($aiServicesAccount.kind), Region: $($aiServicesAccount.location))" -ForegroundColor Cyan
Write-Host "  Endpoint:            $($aiServicesAccount.properties.endpoint)" -ForegroundColor Gray
Write-Host "  Model Deployments:   $(if ($aiServicesDeployments.Count -gt 0) { $aiServicesDeployments -join ', ' } else { 'None (0 deployed)' })" -ForegroundColor $(if ($aiServicesDeployments.Count -gt 0) { 'Green' } else { 'DarkYellow' })

# Verified target: Explicitly use ai-meeting-assistant-5g-resource (eastus2)
# (ai-meeting-assistant in eastus has 0 deployments and MUST NOT be used)
$aiResourceName = $aiServicesAccountName
$aiEndpoint = "https://ai-meeting-assistant-5g-resource.openai.azure.com/"
$deploymentList = $aiServicesDeployments

# Speech Service is hosted in eastus2 on ai-meeting-assistant-5g-resource
$speechResourceName = $aiServicesAccountName
$speechRegion = "eastus2"

# Extract OpenAI API Key securely from Azure CLI (or local .env fallback)
$apiKey = ""
try {
    $keysJson = az cognitiveservices account keys list -g $ResourceGroup -n $aiResourceName --output json 2>$null
    if ($keysJson) {
        $keys = $keysJson | ConvertFrom-Json
        $apiKey = $keys.key1
    }
} catch {
    Write-Warning "Could not fetch OpenAI keys directly via Azure CLI. Falling back to local .env..."
}

# Extract Speech API Key securely from ai-meeting-assistant-5g-resource
$speechKey = ""
try {
    $speechKeysJson = az cognitiveservices account keys list -g $ResourceGroup -n $speechResourceName --output json 2>$null
    if ($speechKeysJson) {
        $speechKeys = $speechKeysJson | ConvertFrom-Json
        $speechKey = $speechKeys.key1
    }
} catch {
    Write-Warning "Could not fetch Speech keys directly via Azure CLI. Falling back to OpenAI key..."
}
if (-not $speechKey) {
    $speechKey = $apiKey
}

if (-not $apiKey -and (Test-Path ".env")) {
    $envLines = Get-Content ".env"
    foreach ($line in $envLines) {
        if ($line -match "^AZURE_OPENAI_API_KEY=(.+)$") {
            $apiKey = $matches[1].Trim()
        }
        if ($line -match "^AZURE_OPENAI_ENDPOINT=(.+)$") {
            $aiEndpoint = $matches[1].Trim()
        }
    }
}

if (-not $apiKey) {
    Write-Error "Could not retrieve Azure OpenAI / Speech API key. Please ensure 'ai-meeting-assistant-5g-resource' exists in '$ResourceGroup'."
    exit 1
}

# 3. Determine Unique App Service Name and Validate Availability
if ([string]::IsNullOrWhiteSpace($AppName)) {
    # Generate unique 6-character random suffix if not supplied
    $randSuffix = (Get-Random -Minimum 100000 -Maximum 999999).ToString()
    $AppName = "vocalis-app-$randSuffix"
}

# Verify name validity and availability with Azure API
Write-Host "Verifying App Service name availability for '$AppName'..." -ForegroundColor Gray
$tempNameFile = [System.IO.Path]::GetTempFileName()
try {
    Set-Content -Path $tempNameFile -Value "{`"name`":`"$AppName`",`"type`":`"Microsoft.Web/sites`"}"
    $checkRaw = az rest --method post --uri "/subscriptions/$subId/providers/Microsoft.Web/checknameavailability?api-version=2022-03-01" --headers "Content-Type=application/json" --body "@$tempNameFile" 2>$null
    if ($checkRaw) {
        $checkResult = $checkRaw | ConvertFrom-Json
        if (-not $checkResult.nameAvailable) {
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = "SilentlyContinue"
            $null = az webapp show --name $AppName --resource-group $ResourceGroup --only-show-errors 2>&1
            $appExistsInRg = ($LASTEXITCODE -eq 0)
            $ErrorActionPreference = $prevEap

            if (-not $appExistsInRg) {
                Write-Error "The Web App name '$AppName' is unavailable or invalid: $($checkResult.message)"
                exit 1
            }
        }
    }
} finally {
    if (Test-Path $tempNameFile) { Remove-Item -Force $tempNameFile }
}
$plannedUrl = "https://$AppName.azurewebsites.net"

# 4. Display Pre-Deployment Summary & Require Explicit Confirmation
Write-Host "`n================ Deployment Plan Summary ================" -ForegroundColor Cyan
Write-Host "Subscription:        $subName ($subId)"
Write-Host "Resource Group:      $ResourceGroup"
Write-Host "Location / Region:   $Location"
Write-Host "App Service Plan:    $PlanName (Linux, SKU: $Sku)"
Write-Host "Web App Name:        $AppName"
Write-Host "Target URL:          $plannedUrl"
Write-Host "Runtime:             Node.js 24 LTS (NODE|24-lts)"
Write-Host "WebSockets:          Enabled"
Write-Host "Always On:           Enabled"
Write-Host "Reused AI Resource:  $aiResourceName"
Write-Host "Chat Model:          gpt-4.1-mini"
Write-Host "Whisper Model:       whisper"
Write-Host "Embedding Model:     text-embedding-3-small"
Write-Host "Speech Region:       $speechRegion"
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $ConfirmDeployment) {
    Write-Host "`n[SAFETY STOP] No resources were created." -ForegroundColor Yellow
    Write-Host "To confirm and execute this deployment, run:" -ForegroundColor Green
    Write-Host "  .\scripts\deploy-azure.ps1 -AppName `"$AppName`" -ConfirmDeployment`n" -ForegroundColor White
    exit 0
}

Write-Host "`nConfirmation received! Proceeding with Azure deployment..." -ForegroundColor Green

# 5. Build Monorepo (Packages, Frontend, Backend)
Write-Host "`n[3/7] Compiling production build..." -ForegroundColor Yellow
$rootPath = (Get-Item -Path ".").FullName
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Production build failed. Please fix build errors before deploying."
    exit 1
}
Write-Host "Build completed successfully." -ForegroundColor Green

# 6. Ensure App Service Plan & Web App Exist
Write-Host "`n[4/7] Checking / Creating App Service Plan ($PlanName)..." -ForegroundColor Yellow

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$planShowOutput = az appservice plan show --name $PlanName --resource-group $ResourceGroup -o json 2>&1
$planShowExitCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap

$planString = ($planShowOutput | Out-String).Trim()
$planObj = $null

if ($planShowExitCode -eq 0) {
    Write-Host "App Service Plan '$PlanName' already exists. Reusing existing plan." -ForegroundColor Green
    $planObj = $planShowOutput | ConvertFrom-Json
} else {
    # Check if the failure was specifically ResourceNotFound (expected when plan has not been created yet)
    $isNotFound = ($planString -match "ResourceNotFound" -or $planString -match "Not Found" -or $planString -match "was not found")
    if ($isNotFound) {
        Write-Host "App Service Plan '$PlanName' does not exist yet. Creating Linux B1 plan in $Location..." -ForegroundColor Cyan
        $planCreateArgs = @(
            "appservice", "plan", "create",
            "--name", $PlanName,
            "--resource-group", $ResourceGroup,
            "--location", $Location,
            "--is-linux",
            "--sku", $Sku,
            "--output", "none"
        )
        & az @planCreateArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create App Service Plan '$PlanName' in $Location."
            exit 1
        }

        # Verify creation succeeded and fetch created plan details
        $createdPlanRaw = az appservice plan show --name $PlanName --resource-group $ResourceGroup -o json
        if ($LASTEXITCODE -ne 0 -or -not $createdPlanRaw) {
            Write-Error "Failed to retrieve App Service Plan '$PlanName' following creation."
            exit 1
        }
        $planObj = $createdPlanRaw | ConvertFrom-Json
        Write-Host "App Service Plan '$PlanName' created successfully." -ForegroundColor Green
    } else {
        # Real Azure error (e.g. AuthenticationFailed, AuthorizationFailed, QuotaExceeded) - do not suppress
        Write-Error "Unexpected Azure error while querying App Service Plan '$PlanName':`n$planString"
        exit 1
    }
}

# Post-creation / reuse verification: plan exists, Linux, B1 SKU, correct location
Write-Host "Verifying App Service Plan properties..." -ForegroundColor Gray
if (-not $planObj) {
    Write-Error "App Service Plan '$PlanName' could not be resolved."
    exit 1
}

# Verify Location
$planLocationNormalized = $planObj.location.ToLower().Replace(" ", "")
$expectedLocationNormalized = $Location.ToLower().Replace(" ", "")
if ($planLocationNormalized -ne $expectedLocationNormalized) {
    Write-Error "App Service Plan location mismatch: expected '$Location', found '$($planObj.location)'."
    exit 1
}

# Verify Linux
$isLinux = ($planObj.reserved -eq $true -or ($planObj.kind -and $planObj.kind.ToLower().Contains("linux")))
if (-not $isLinux) {
    Write-Error "App Service Plan '$PlanName' is not a Linux plan (kind: $($planObj.kind), reserved: $($planObj.reserved)). Vocalis requires Linux."
    exit 1
}

# Verify B1 SKU
$planSkuName = if ($planObj.sku.name) { $planObj.sku.name } else { $planObj.sku.size }
if ($planSkuName -notmatch "B1") {
    Write-Warning "App Service Plan SKU is '$planSkuName' (expected 'B1'). Continuing with plan."
} else {
    Write-Host "Verified Plan: Name='$PlanName', OS=Linux, SKU=$planSkuName, Location=$($planObj.location)." -ForegroundColor Green
}

Write-Host "`n[5/7] Checking / Creating Web App ($AppName)..." -ForegroundColor Yellow

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$appShowOutput = az webapp show --name $AppName --resource-group $ResourceGroup -o json 2>&1
$appShowExitCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap

$appString = ($appShowOutput | Out-String).Trim()

if ($appShowExitCode -eq 0) {
    Write-Host "Web App '$AppName' already exists. Reusing existing Web App." -ForegroundColor Green
} else {
    $isAppNotFound = ($appString -match "ResourceNotFound" -or $appString -match "Not Found" -or $appString -match "was not found")
    if ($isAppNotFound) {
        Write-Host "Creating Web App '$AppName' with Node 24 LTS runtime (NODE|24-lts)..." -ForegroundColor Cyan
        $createArgs = @(
            "webapp", "create",
            "--name", $AppName,
            "--plan", $PlanName,
            "--resource-group", $ResourceGroup,
            "--runtime", '"NODE|24-lts"',
            "--output", "none"
        )
        & az @createArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create Web App '$AppName' in resource group '$ResourceGroup'. Stopping deployment."
            exit 1
        }
        Write-Host "Web App '$AppName' created successfully." -ForegroundColor Green
    } else {
        # Real Azure error, do not suppress
        Write-Error "Unexpected Azure error while querying Web App '$AppName':`n$appString"
        exit 1
    }
}

# Post-creation / reuse verification: Verify the Web App exists immediately after creation
Write-Host "Verifying Web App '$AppName' exists in Azure..." -ForegroundColor Gray
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$verifyAppOutput = az webapp show --name $AppName --resource-group $ResourceGroup -o json 2>&1
$verifyAppExitCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($verifyAppExitCode -ne 0) {
    Write-Error "Web App '$AppName' verification failed. The app does not exist or cannot be accessed:`n$($verifyAppOutput | Out-String)"
    exit 1
}

$appDetails = $verifyAppOutput | ConvertFrom-Json
if (-not $appDetails -or -not $appDetails.defaultHostName) {
    Write-Error "Web App '$AppName' verification failed: No valid host name returned from Azure."
    exit 1
}
Write-Host "Verified Web App: Name='$($appDetails.name)', State='$($appDetails.state)', Hostname='$($appDetails.defaultHostName)'." -ForegroundColor Green

# Configure WebSockets, Always On, and Node startup
Write-Host "Configuring WebSockets, Always On, and startup command..." -ForegroundColor Cyan
$configArgs = @(
    "webapp", "config", "set",
    "--resource-group", $ResourceGroup,
    "--name", $AppName,
    "--always-on", "true",
    "--web-sockets-enabled", "true",
    "--startup-file", "npm start",
    "--output", "none"
)
& az @configArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to configure Web App settings (WebSockets, Always On, startup command) for '$AppName'."
    exit 1
}
Write-Host "Web App configuration applied successfully." -ForegroundColor Green

# Configure Secure Server-Side App Settings (NEVER exposed to frontend bundle)
Write-Host "Configuring Azure App Settings (environment variables)..." -ForegroundColor Cyan
$appSettingsArgs = @(
    "webapp", "config", "appsettings", "set",
    "--resource-group", $ResourceGroup,
    "--name", $AppName,
    "--settings",
        "NODE_ENV=production",
        "CORS_ORIGIN=https://$AppName.azurewebsites.net",
        "AZURE_OPENAI_ENDPOINT=$aiEndpoint",
        "AZURE_OPENAI_API_KEY=$apiKey",
        "AZURE_OPENAI_DEPLOYMENT_WHISPER=whisper",
        "AZURE_OPENAI_DEPLOYMENT_CHAT=gpt-4.1-mini",
        "AZURE_OPENAI_DEPLOYMENT_EMBEDDING=text-embedding-3-small",
        "AZURE_SPEECH_REGION=$speechRegion",
        "AZURE_SPEECH_KEY=$speechKey",
        "SCM_DO_BUILD_DURING_DEPLOYMENT=true",
    "--output", "none"
)
& az @appSettingsArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to configure App Settings for Web App '$AppName'."
    exit 1
}
Write-Host "App Settings configured successfully." -ForegroundColor Green

# 7. Package and Deploy Application via ZIP
Write-Host "`n[6/7] Creating clean deployment artifact..." -ForegroundColor Yellow
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "vocalis-deploy-$((Get-Random).ToString())"
$zipPath = Join-Path ([System.IO.Path]::GetTempPath()) "$AppName.zip"

if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

New-Item -ItemType Directory -Path $tempDir | Out-Null

# 1. Root package.json (preserve workspaces and start script, ensure Oryx pre-build script succeeds)
$rootPkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$rootPkg.scripts.build = "echo Pre-compiled production build ready"
$rootPkg | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $tempDir "package.json")

if (Test-Path "package-lock.json") {
    Copy-Item "package-lock.json" (Join-Path $tempDir "package-lock.json")
}

# 2. Copy compiled backend
$backendTarget = Join-Path $tempDir "apps/backend"
New-Item -ItemType Directory -Path $backendTarget -Force | Out-Null
$backendPkg = Get-Content "apps/backend/package.json" -Raw | ConvertFrom-Json
$backendPkg.scripts.build = "echo Pre-compiled backend dist ready"
$backendPkg | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $backendTarget "package.json")
Copy-Item -Recurse "apps/backend/dist" (Join-Path $backendTarget "dist")

# 3. Copy compiled frontend
$frontendTarget = Join-Path $tempDir "apps/frontend"
New-Item -ItemType Directory -Path $frontendTarget -Force | Out-Null
$frontendPkg = Get-Content "apps/frontend/package.json" -Raw | ConvertFrom-Json
$frontendPkg.scripts.build = "echo Pre-compiled frontend dist ready"
$frontendPkg | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $frontendTarget "package.json")
Copy-Item -Recurse "apps/frontend/dist" (Join-Path $frontendTarget "dist")

# 4. Copy compiled shared-types
$typesTarget = Join-Path $tempDir "packages/shared-types"
New-Item -ItemType Directory -Path $typesTarget -Force | Out-Null
$typesPkg = Get-Content "packages/shared-types/package.json" -Raw | ConvertFrom-Json
$typesPkg.scripts.build = "echo Pre-compiled shared-types dist ready"
$typesPkg | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $typesTarget "package.json")
Copy-Item -Recurse "packages/shared-types/dist" (Join-Path $typesTarget "dist")

# 5. Compress using .NET ZipFile to guarantee POSIX forward slashes (/) for Linux extraction
Write-Host "Compressing deployment package with POSIX forward slashes..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipArchive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$allFiles = Get-ChildItem -Path $tempDir -Recurse -File
foreach ($file in $allFiles) {
    $relPath = $file.FullName.Substring($tempDir.Length).TrimStart("\", "/").Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $file.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Fastest)
}
$zipArchive.Dispose()
Remove-Item -Recurse -Force $tempDir

if (-not (Test-Path $zipPath)) {
    Write-Error "Deployment package '$zipPath' was not created."
    exit 1
}

Write-Host "`n[7/7] Deploying application ZIP to Azure App Service..." -ForegroundColor Yellow
$deployArgs = @(
    "webapp", "deploy",
    "--resource-group", $ResourceGroup,
    "--name", $AppName,
    "--src-path", $zipPath,
    "--type", "zip",
    "--clean", "true",
    "--restart", "true"
)
& az @deployArgs

$deployExitCode = $LASTEXITCODE
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

if ($deployExitCode -ne 0) {
    Write-Error "Deployment of ZIP package to Web App '$AppName' failed with exit code $deployExitCode."
    exit 1
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   Deployment Completed Successfully!                    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Application URL: $plannedUrl" -ForegroundColor Cyan
Write-Host "Health Check:    $plannedUrl/health" -ForegroundColor Cyan
Write-Host "WebSocket URL:   wss://$AppName.azurewebsites.net/api/sessions/live-stream" -ForegroundColor Cyan
