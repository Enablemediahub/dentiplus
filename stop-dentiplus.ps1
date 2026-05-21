$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runLogs = Join-Path $root 'run-logs'
$stateFile = Join-Path $runLogs 'dentiplus-processes.json'

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
            Write-Host "Stopped orphan Dentiplus process PID $($process.ProcessId)." -ForegroundColor Green
        } catch {
            # Ignore already-stopped orphan processes.
        }
    }
}

function Stop-TrackedProcess {
    param(
        [Parameter(Mandatory = $false)]
        [int]$Id,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (-not $Id) {
        return
    }

    try {
        $process = Get-Process -Id $Id -ErrorAction Stop
        Stop-Process -Id $process.Id -Force
        Write-Host "$Label stopped (PID $Id)." -ForegroundColor Green
    } catch {
        Write-Host "$Label was not running." -ForegroundColor Yellow
    }
}

if (-not (Test-Path $stateFile)) {
    Write-Host 'No Dentiplus process file was found. Checking for orphan Dentiplus processes instead.' -ForegroundColor Yellow
    Stop-OrphanDentiplusProcesses
    Write-Host 'Dentiplus stop routine completed.'
    exit 0
}

$state = Get-Content $stateFile -Raw | ConvertFrom-Json

Stop-TrackedProcess -Id $state.frontendPid -Label 'Frontend'
Stop-TrackedProcess -Id $state.backendPid -Label 'Backend'
Stop-OrphanDentiplusProcesses

Remove-Item $stateFile -Force

Write-Host 'Dentiplus stop routine completed.'
