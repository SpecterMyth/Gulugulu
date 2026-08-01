<#
  Builds the Gulugulu release and stages the SteamPipe depot content.
  Usage (from anywhere):
    powershell -ExecutionPolicy Bypass -File scripts\steam\stage_and_build.ps1
    powershell -ExecutionPolicy Bypass -File scripts\steam\stage_and_build.ps1 -SkipBuild

  After it finishes, upload with steamcmd (YOUR Steam login + Steam Guard):
    steamcmd +login <steamAccount> +run_app_build "<repo>\projects\gulugulu-app\scripts\steam\app_build_4956830.vdf" +quit
#>
param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$steamDir = $PSScriptRoot
$appDir   = (Resolve-Path (Join-Path $steamDir '..\..')).Path
$relDir   = Join-Path $appDir 'src-tauri\target\release'
$content  = Join-Path $steamDir 'content'

if (-not $SkipBuild) {
    # The Tauri CLI applies the production frontendDist configuration and embeds
    # dist\ into the executable. Steam needs the raw files, not MSI/NSIS bundles.
    Push-Location $appDir
    try {
        Write-Host "==> Building production Tauri executable (no installer bundle)..." -ForegroundColor Cyan
        & (Join-Path $appDir 'node_modules\.bin\tauri.cmd') build --no-bundle
        if ($LASTEXITCODE -ne 0) { throw "tauri build --no-bundle failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
}

$exe = @('Gulugulu.exe','gulugulu.exe') |
       ForEach-Object { Join-Path $relDir $_ } |
       Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) {
    throw "Release exe not found in $relDir (Gulugulu.exe / gulugulu.exe). Run without -SkipBuild first."
}

# Steam's Windows depot must launch as a GUI app. Fail packaging if the release
# entry point regresses to the console subsystem (IMAGE_SUBSYSTEM_WINDOWS_CUI=3).
$exeStream = [System.IO.File]::OpenRead($exe)
try {
    $exeReader = [System.IO.BinaryReader]::new($exeStream)
    $exeStream.Position = 0x3c
    $peOffset = $exeReader.ReadInt32()
    $exeStream.Position = $peOffset + 24 + 68
    $subsystem = $exeReader.ReadUInt16()
} finally {
    $exeStream.Dispose()
}
if ($subsystem -ne 2) {
    throw "Release exe uses PE subsystem $subsystem; expected Windows GUI subsystem 2."
}

$dll = Join-Path $relDir 'steam_api64.dll'
if (-not (Test-Path $dll)) {
    $dll = Get-ChildItem -Path $relDir -Recurse -Filter 'steam_api64.dll' -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty FullName
}
if (-not $dll -or -not (Test-Path $dll)) { throw "steam_api64.dll not found under $relDir" }

# Resolve the paths before recursively replacing generated staging content.
$steamRoot = [System.IO.Path]::GetFullPath($steamDir).TrimEnd('\') + '\'
$contentRoot = [System.IO.Path]::GetFullPath($content)
if (-not $contentRoot.StartsWith($steamRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean content outside Steam staging directory: $contentRoot"
}
if (Test-Path $content) { Remove-Item $content -Recurse -Force }
New-Item -ItemType Directory -Path $content | Out-Null
Copy-Item $exe (Join-Path $content 'Gulugulu.exe')
Copy-Item $dll (Join-Path $content 'steam_api64.dll')

Write-Host ""
Write-Host "==> Staged depot content -> $content" -ForegroundColor Green
Get-ChildItem $content | ForEach-Object { "    {0,-20} {1,10:N0} bytes" -f $_.Name, $_.Length }
Write-Host ""
Write-Host "Next (Steam Guard 2FA must be completed by the account owner):" -ForegroundColor Yellow
Write-Host ("    steamcmd +login <steamAccount> +run_app_build `"{0}`" +quit" -f (Join-Path $steamDir 'app_build_4956830.vdf'))
