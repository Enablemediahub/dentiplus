$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmpRoot = Join-Path $root 'tmp'
$packageRoot = Join-Path $tmpRoot 'hostinger-package'
$backendSource = Join-Path $root 'backend'
$frontendDist = Join-Path $root 'frontend\dist'
$frontendPublic = Join-Path $root 'frontend\public'
$backendItems = @('app', 'bootstrap', 'routes', '.env.example', '.env.hostinger.example')
$hostingerEnvExamplePath = Join-Path $backendSource '.env.hostinger.example'
$hostingerEnvPath = Join-Path $packageRoot '.env'
$rootBridgeFiles = @('.htaccess', 'index.php')

if (-not (Test-Path $frontendDist)) {
    throw "Frontend dist folder not found at $frontendDist. Run 'npm.cmd run build' in frontend first."
}

if (Test-Path $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $packageRoot | Out-Null

foreach ($item in $backendItems) {
    $sourcePath = Join-Path $backendSource $item
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination (Join-Path $packageRoot $item) -Recurse -Force
    }
}

foreach ($item in $rootBridgeFiles) {
    $sourcePath = Join-Path $root $item
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination (Join-Path $packageRoot $item) -Force
    }
}

if (Test-Path $hostingerEnvExamplePath) {
    Copy-Item -Path $hostingerEnvExamplePath -Destination $hostingerEnvPath -Force
}

$publicTarget = Join-Path $packageRoot 'public_html'
Copy-Item -Path (Join-Path $backendSource 'public') -Destination $publicTarget -Recurse -Force
Copy-Item -Path (Join-Path $frontendDist '*') -Destination $publicTarget -Recurse -Force
Copy-Item -Path (Join-Path $frontendPublic '*') -Destination $publicTarget -Recurse -Force

if (Test-Path (Join-Path $publicTarget 'router.php')) {
    Remove-Item -LiteralPath (Join-Path $publicTarget 'router.php') -Force
}

$deployNotes = @'
Dentiplus Hostinger package

Contents
- app/
- bootstrap/
- public_html/
- routes/
- .env
- .env.example
- .env.hostinger.example

Suggested upload flow
1. Upload the PHP app folders in this package root directly into your Hostinger target folder.
2. The compiled frontend is already inside public_html/ as index.html, assets/, favicon, and logos.
3. .env is included as a production starter. Fill in DB_USERNAME and DB_PASSWORD before or after upload.
4. .env.hostinger.example is included as a clean backup template if you want to start over.
5. Point the domain or subfolder document root to this package's public_html/ folder whenever Hostinger allows it.
6. If Hostinger points the domain to the package root instead, the package-level .htaccess and index.php now forward requests into public_html/.

Notes
- The package .env is generated from backend/.env.hostinger.example, not copied from your local machine.
- No Node.js is needed on Hostinger. React is prebuilt and served as static files from public_html/.
- The public_html/ folder is the only web root the server needs.
'@

Set-Content -Path (Join-Path $packageRoot 'HOSTINGER_DEPLOY.txt') -Value $deployNotes

Write-Host "Dentiplus Hostinger package ready at $packageRoot" -ForegroundColor Green
