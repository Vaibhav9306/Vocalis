# AI Meeting Assistant - Local Development Launcher
Write-Host "Starting AI Meeting Assistant (Backend on :3001, Frontend on :5173)..." -ForegroundColor Cyan

# Start Backend in a background process / parallel job
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev:backend
}

Write-Host "Backend server started in background (Job ID: $($backendJob.Id))." -ForegroundColor Green
Write-Host "Launching Frontend dev server..." -ForegroundColor Cyan

try {
    npm run dev:frontend
} finally {
    Write-Host "Terminating background backend job..." -ForegroundColor Yellow
    Stop-Job $backendJob
    Remove-Job $backendJob
}
