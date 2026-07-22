<#
  Builds the Gulugulu release and stages the SteamPipe depot content.
  Usage (from anywhere):
    powershell -ExecutionPolicy Bypass -File scripts\steam\stage_and_build.ps1            # build + stage
    powershell -ExecutionPolicy Bypass -File scripts\steam\stage_and_build.ps1 -SkipBuild  # stage only (reuse target\release)

  After it finishes, upload with steamcmd (YOUR Steam login + Steam Guard):
    steamcmd +login <steamAccount> +run_app_build "<repo>\projects\gulugulu-app\scripts\steam\app_build_4956830.vdf" +quit
#>
param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$steamDir = $PSScriptRoot                                  # ...\scripts\steam
$appDir   = (Resolve-Path (Join-Path $steamDir '..\..')).Path   # ...\projects\gulugulu-app
$relDir   = Join-Path $appDir 'src-tauri\target\release'
$content  = Join-Path $steamDir 'content'

if (-not $SkipBuild) {
    # Frontend (tsc + vite → dist\, which Tauri embeds at compile time), then the
    # release exe. cargo build --release yields a complete Tauri binary (icon +
    # manifest + embedded frontend via build.rs) and steam_api64.dll, and skips
    # the installer bundling that `tauri build` adds (not needed for a raw depot).
    Push-Location $appDir
    try {
        Write-Host "==> Building frontend (npm run build)..." -ForegroundColor Cyan
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }

        Write-Host "==> Building release exe (cargo build --release) — can take several minutes..." -ForegroundColor Cyan
        Push-Location (Join-Path $appDir 'src-tauri')
        try { & cargo build --release } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { throw "cargo build --release failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
}

# Locate the release exe (tauri:build renames to Gulugulu.exe; cargo bin is gulugulu.exe).
$exe = @('Gulugulu.exe','gulugulu.exe') |
       ForEach-Object { Join-Path $relDir $_ } |
       Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { throw "Release exe not found in $relDir (Gulugulu.exe / gulugulu.exe). Run without -SkipBuild first." }

$dll = Join-Path $relDir 'steam_api64.dll'
if (-not (Test-Path $dll)) {
    $dll = Get-ChildItem -Path $relDir -Recurse -Filter 'steam_api64.dll' -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty FullName
}
if (-not $dll -or -not (Test-Path $dll)) { throw "steam_api64.dll not found under $relDir" }

# Stage a clean content dir.
if (Test-Path $content) { Remove-Item $content -Recurse -Force }
New-Item -ItemType Directory -Path $content | Out-Null
Copy-Item $exe (Join-Path $content 'Gulugulu.exe')
Copy-Item $dll (Join-Path $content 'steam_api64.dll')

Write-Host ""
Write-Host "==> Staged depot content -> $content" -ForegroundColor Green
Get-ChildItem $content | ForEach-Object { "    {0,-20} {1,10:N0} bytes" -f $_.Name, $_.Length }
Write-Host ""
Write-Host "Next (YOU run this — Steam Guard 2FA is required and must be you):" -ForegroundColor Yellow
Write-Host ("    steamcmd +login <steamAccount> +run_app_build `"{0}`" +quit" -f (Join-Path $steamDir 'app_build_4956830.vdf'))
