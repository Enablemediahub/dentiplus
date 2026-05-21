$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Join-Path $root 'frontend'
$runLogs = Join-Path $root 'run-logs'
$stateFile = Join-Path $runLogs 'dentiplus-processes.json'
$viteCli = Join-Path $frontendRoot 'node_modules\vite\bin\vite.js'

function Stop-OrphanDentiplusProcesses {
    $processes = Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -and (
            $_.CommandLine -like "*$root*frontend*vite*bin*vite.js*" -or
            $_.CommandLine -like "*$root*backend*public*router.php*"
        )
    }

    foreach ($process in $processes) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
        } catch {
            # Ignore already-stopped orphan processes.
        }
    }
}

if (-not (Test-Path $runLogs)) {
    New-Item -ItemType Directory -Path $runLogs | Out-Null
}

function Test-RunningProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Id
    )

    try {
        $null = Get-Process -Id $Id -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

if (Test-Path $stateFile) {
    $existing = Get-Content $stateFile -Raw | ConvertFrom-Json
    $frontendRunning = $existing.frontendPid -and (Test-RunningProcess -Id $existing.frontendPid)
    $backendRunning = $existing.backendPid -and (Test-RunningProcess -Id $existing.backendPid)

    if ($frontendRunning -or $backendRunning) {
        Write-Host 'Dentiplus servers already appear to be running.' -ForegroundColor Yellow
        if ($frontendRunning) {
            Write-Host "Frontend PID: $($existing.frontendPid) -> http://localhost:5176"
        }
        if ($backendRunning) {
            Write-Host "Backend PID: $($existing.backendPid) -> http://127.0.0.1:8000/api/v1"
        }
        exit 0
    }
}

$node = (Get-Command node -ErrorAction Stop).Source
$php = (Get-Command php -ErrorAction Stop).Source

if (-not (Test-Path $viteCli)) {
    throw "Vite CLI not found at $viteCli. Run 'npm install' inside frontend first."
}

Stop-OrphanDentiplusProcesses

$frontendOut = Join-Path $runLogs 'frontend.out.log'
$frontendErr = Join-Path $runLogs 'frontend.err.log'
$backendOut = Join-Path $runLogs 'backend.out.log'
$backendErr = Join-Path $runLogs 'backend.err.log'

$frontendProcess = Start-Process `
    -FilePath $node `
    -ArgumentList $viteCli, '--host', '0.0.0.0', '--port', '5176', '--strictPort' `
    -WorkingDirectory $frontendRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr `
    -PassThru

$backendProcess = Start-Process `
    -FilePath $php `
    -ArgumentList '-S', '127.0.0.1:8000', '-t', 'backend/public', 'backend/public/router.php' `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -PassThru

$state = [ordered]@{
    startedAt = (Get-Date).ToString('s')
    frontendPid = $frontendProcess.Id
    backendPid = $backendProcess.Id
    frontendUrl = 'http://localhost:5176'
    backendUrl = 'http://127.0.0.1:8000/api/v1'
    logs = @{
        frontendOut = $frontendOut
        frontendErr = $frontendErr
        backendOut = $backendOut
        backendErr = $backendErr
    }
}

$state | ConvertTo-Json -Depth 3 | Set-Content $stateFile

Write-Host 'Dentiplus servers started.' -ForegroundColor Green
Write-Host 'Frontend: http://localhost:5176'
Write-Host 'Backend:  http://127.0.0.1:8000/api/v1'
Write-Host "Process file: $stateFile"
Write-Host "Logs: $runLogs"
