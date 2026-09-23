# AI Meeting Assistant - Local Audio Transcription Test Script
param (
    [string]$AudioPath = "$PSScriptRoot\sample_test.wav",
    [string]$Endpoint = "http://localhost:3001/api/transcription"
)

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   AI Meeting Assistant - Whisper Test Client   " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

if (-not (Test-Path $AudioPath)) {
    Write-Error "Audio file not found at: $AudioPath"
    exit 1
}

$fileItem = Get-Item $AudioPath
Write-Host "Audio File: $($fileItem.Name) ($([math]::Round($fileItem.Length / 1KB, 2)) KB)" -ForegroundColor Yellow
Write-Host "Target Endpoint: $Endpoint" -ForegroundColor Gray
Write-Host "Sending audio to backend transcription API..." -ForegroundColor Cyan

$startTime = Get-Date

try {
    # Use curl.exe for reliable cross-PowerShell multipart upload
    $rawResponse = curl.exe -s -S -X POST $Endpoint -F "audio=@$AudioPath"
    $elapsed = ((Get-Date) - $startTime).TotalSeconds

    $response = $rawResponse | ConvertFrom-Json

    if ($response.success) {
        Write-Host "`n-------------------------------------------------" -ForegroundColor Green
        Write-Host "Transcription Succeeded in $([math]::Round($elapsed, 2))s!" -ForegroundColor Green
        Write-Host "-------------------------------------------------" -ForegroundColor Green
        Write-Host "Detected Language : $($response.language)" -ForegroundColor Yellow
        Write-Host "Audio Duration    : $([math]::Round($response.durationSeconds, 2))s" -ForegroundColor Yellow
        Write-Host "`nTRANSCRIPT:" -ForegroundColor Cyan
        Write-Host "$($response.transcript)" -ForegroundColor White

        if ($response.segments) {
            Write-Host "`nSEGMENTS ($($response.segments.Count)):" -ForegroundColor Gray
            foreach ($seg in $response.segments) {
                Write-Host "  [$($seg.start)s - $($seg.end)s]: $($seg.text)" -ForegroundColor Gray
            }
        }
        Write-Host "=================================================" -ForegroundColor Cyan
    } else {
        Write-Host "`n-------------------------------------------------" -ForegroundColor Red
        Write-Host "Transcription Failed: $($response.error.message)" -ForegroundColor Red
        Write-Host "=================================================" -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "`n-------------------------------------------------" -ForegroundColor Red
    Write-Host "Error executing request: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "=================================================" -ForegroundColor Cyan
    exit 1
}
