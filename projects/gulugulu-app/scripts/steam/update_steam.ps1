<#
.SYNOPSIS
  Builds the current Gulugulu workspace and uploads it to Steam.

.DESCRIPTION
  Single-command Steam release pipeline for App 4956830 / Depot 4956831. It builds
  and stages the Windows release, creates an audit ZIP, generates an isolated
  SteamPipe VDF, uploads through SteamCMD, and records the Build/Manifest IDs in a
  JSON result file. Valve does not allow SteamCMD to set the default branch live;
  default builds must be promoted manually on the Steamworks Builds page.

  The first SteamCMD login may ask for the account password and Steam Guard approval
  in the current console. SteamCMD can reuse its cached login on later runs.
#>
[CmdletBinding()]
param(
    [string]$SteamAccount = 'mobistudio',
    [ValidatePattern('^[A-Za-z0-9._-]+$')]
    [string]$Branch = 'default',
    [string]$Description = '',
    [string]$SteamCmdPath = '',
    [ValidateRange(1, 5)]
    [int]$LoginAttempts = 3,
    [switch]$SkipBuild,
    [switch]$RunTests,
    [switch]$BuildOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$AppId = '4956830'
$DepotId = '4956831'
$steamDir = $PSScriptRoot
$appDir = (Resolve-Path (Join-Path $steamDir '..\..')).Path
$contentDir = Join-Path $steamDir 'content'
$outputRoot = Join-Path $steamDir 'output'
$stageScript = Join-Path $steamDir 'stage_and_build.ps1'
$depotVdf = Join-Path $steamDir 'depot_build_4956831.vdf'

function Resolve-SteamCmd {
    param([string]$RequestedPath)

    if ($RequestedPath) {
        $resolved = Resolve-Path -LiteralPath $RequestedPath -ErrorAction SilentlyContinue
        if (-not $resolved) { throw "SteamCMD not found: $RequestedPath" }
        return $resolved.Path
    }

    $command = Get-Command steamcmd.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidates = @(
        'C:\steamcmd\steamcmd.exe',
        'C:\SteamCMD\steamcmd.exe',
        'D:\steamcmd\steamcmd.exe',
        'D:\SteamCMD\steamcmd.exe',
        (Join-Path $env:LOCALAPPDATA 'SteamCMD\steamcmd.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'SteamCMD was not found. Install it to C:\steamcmd or pass -SteamCmdPath.'
}

function ConvertTo-VdfPath {
    param([string]$Path)
    return ([System.IO.Path]::GetFullPath($Path) -replace '\\', '\\')
}

function Get-PeSubsystem {
    param([string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $reader = [System.IO.BinaryReader]::new($stream)
        $stream.Position = 0x3c
        $peOffset = $reader.ReadInt32()
        $stream.Position = $peOffset + 24 + 68
        return $reader.ReadUInt16()
    } finally {
        $stream.Dispose()
    }
}

function Get-LastRegexGroup {
    param([string]$Text, [string]$Pattern)
    $matches = [regex]::Matches($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($matches.Count -eq 0) { return $null }
    return $matches[$matches.Count - 1].Groups[1].Value
}

if (-not (Test-Path -LiteralPath $outputRoot)) {
    New-Item -ItemType Directory -Path $outputRoot | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runDir = Join-Path $outputRoot "publish-$stamp"
$steamBuildOutput = Join-Path $runDir 'steamcmd-output'
New-Item -ItemType Directory -Path $steamBuildOutput -Force | Out-Null

if (-not $Description) {
    $Description = "Gulugulu current workspace update $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))"
}
$Description = (($Description -replace '[\r\n]+', ' ') -replace '"', "'").Trim()
if (-not $Description) { throw 'Build description cannot be empty.' }

# Valve only permits SetLive for beta branches. The public default branch must be
# promoted manually from Steamworks App Admin after SteamCMD creates the Build ID.
$setLiveValue = if ($Branch -ieq 'default') { '' } else { $Branch }
$requiresManualSetLive = [string]::IsNullOrEmpty($setLiveValue)

Write-Host "==> Gulugulu Steam update" -ForegroundColor Cyan
Write-Host "    App/Depot : $AppId / $DepotId"
Write-Host "    Branch    : $Branch"
Write-Host "    Notes     : $Description"
Write-Host "    Run output: $runDir"

if ($RunTests) {
    Write-Host "`n==> Running Rust release tests..." -ForegroundColor Cyan
    Push-Location (Join-Path $appDir 'src-tauri')
    try {
        & cargo test --release
        if ($LASTEXITCODE -ne 0) { throw "cargo test --release failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

Write-Host "`n==> Building and staging Steam depot..." -ForegroundColor Cyan
$stageArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $stageScript)
if ($SkipBuild) { $stageArgs += '-SkipBuild' }
& powershell.exe @stageArgs
if ($LASTEXITCODE -ne 0) { throw "Steam staging failed (exit $LASTEXITCODE)" }

$stagedFiles = @(Get-ChildItem -LiteralPath $contentDir -File | Sort-Object Name)
$expectedNames = @('Gulugulu.exe', 'steam_api64.dll') | Sort-Object
$actualNames = @($stagedFiles | ForEach-Object Name)
if (($actualNames -join '|') -ne ($expectedNames -join '|')) {
    throw "Unexpected Steam depot contents: $($actualNames -join ', ')"
}

$exePath = Join-Path $contentDir 'Gulugulu.exe'
$subsystem = Get-PeSubsystem -Path $exePath
if ($subsystem -ne 2) {
    throw "Gulugulu.exe uses PE subsystem $subsystem; expected Windows GUI subsystem 2."
}

$fileInfo = @($stagedFiles | ForEach-Object {
    [pscustomobject]@{
        Name = $_.Name
        Bytes = $_.Length
        SHA1 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA1).Hash
    }
})

$zipPath = Join-Path $runDir "gulugulu-v0.1.0-steam-$stamp.zip"
Compress-Archive -LiteralPath ($stagedFiles | ForEach-Object FullName) -DestinationPath $zipPath -CompressionLevel Optimal
$zipSha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash

Write-Host "`n==> Staged package verified" -ForegroundColor Green
$fileInfo | ForEach-Object { Write-Host ("    {0,-20} {1,10:N0} bytes  SHA1 {2}" -f $_.Name, $_.Bytes, $_.SHA1) }
Write-Host "    ZIP        : $zipPath"
Write-Host "    ZIP SHA256 : $zipSha256"

$result = [ordered]@{
    AppId = $AppId
    DepotId = $DepotId
    Branch = $Branch
    Description = $Description
    CreatedAt = (Get-Date).ToString('o')
    ZipPath = $zipPath
    ZipSHA256 = $zipSha256
    Files = $fileInfo
    BuildId = $null
    ManifestId = $null
    Uploaded = $false
    AutoSetLive = -not $requiresManualSetLive
    RequiresManualSetLive = $requiresManualSetLive
    GeneratedVdf = $null
    SteamCmdExitCode = $null
    SteamCmdLog = $null
}

$generatedVdf = Join-Path $runDir 'app_build_4956830.generated.vdf'
$contentVdfPath = ConvertTo-VdfPath $contentDir
$outputVdfPath = ConvertTo-VdfPath $steamBuildOutput
$depotVdfPath = ConvertTo-VdfPath $depotVdf
$vdf = @"
"AppBuild"
{
    "AppID"       "$AppId"
    "Desc"        "$Description"
    "ContentRoot" "$contentVdfPath"
    "BuildOutput" "$outputVdfPath"
    "SetLive"     "$setLiveValue"
    "Depots"
    {
        "$DepotId" "$depotVdfPath"
    }
}
"@
[System.IO.File]::WriteAllText($generatedVdf, $vdf, [System.Text.UTF8Encoding]::new($false))
$result.GeneratedVdf = $generatedVdf

if ($BuildOnly) {
    $resultPath = Join-Path $runDir 'result.json'
    $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    Write-Host "`nBuildOnly selected; no Steam upload was performed." -ForegroundColor Yellow
    Write-Host "Generated VDF: $generatedVdf"
    Write-Host "Result: $resultPath"
    exit 0
}

$steamCmd = Resolve-SteamCmd -RequestedPath $SteamCmdPath

if ($requiresManualSetLive) {
    Write-Host "`n==> Uploading with SteamCMD (default promotion will remain manual)..." -ForegroundColor Cyan
} else {
    Write-Host "`n==> Uploading with SteamCMD and setting Build live on '$Branch'..." -ForegroundColor Cyan
}
Write-Host "    Steam account: $SteamAccount"
Write-Host "    First use may prompt here for your password and Steam Guard approval." -ForegroundColor Yellow
$steamArgs = @('+login', $SteamAccount, '+run_app_build', $generatedVdf, '+quit')
# Keep SteamCMD attached directly to the console. Redirecting it through a PowerShell
# pipeline prevents its interactive password/Steam Guard prompt from initializing.
$steamExitCode = 1
for ($attempt = 1; $attempt -le $LoginAttempts; $attempt++) {
    if ($attempt -gt 1) {
        Write-Host "`n==> Retrying Steam login/upload ($attempt of $LoginAttempts)..." -ForegroundColor Yellow
        Write-Host '    Use the newest Steam Guard code; older email codes may be expired.' -ForegroundColor Yellow
    }
    & $steamCmd @steamArgs
    $steamExitCode = $LASTEXITCODE
    if ($steamExitCode -eq 0) { break }
    # SteamCMD exit 5 is Account Logon Denied (usually a stale/wrong Guard code).
    # Other errors concern the build/upload and should fail instead of duplicating it.
    if ($steamExitCode -ne 5) { break }
}

$appBuildLog = Join-Path $steamBuildOutput 'app_build_4956830.log'
$depotBuildState = Join-Path $steamBuildOutput 'depot_build_4956831.vdf'
$combinedText = ''
if (Test-Path -LiteralPath $appBuildLog) { $combinedText += "`n" + [System.IO.File]::ReadAllText($appBuildLog) }
if (Test-Path -LiteralPath $depotBuildState) { $combinedText += "`n" + [System.IO.File]::ReadAllText($depotBuildState) }

$buildId = Get-LastRegexGroup -Text $combinedText -Pattern 'BuildID\s+(\d+)'
$manifestId = Get-LastRegexGroup -Text $combinedText -Pattern '(?:New\s+manifestID|"manifest")\s+"?(\d+)'
$hasSuccessfulBuild = $combinedText -match 'Successfully finished AppID\s+4956830\s+build'

$result.BuildId = $buildId
$result.ManifestId = $manifestId
$result.Uploaded = [bool]($steamExitCode -eq 0 -and $hasSuccessfulBuild -and $buildId)
$result.SteamCmdExitCode = $steamExitCode
$result.SteamCmdLog = $appBuildLog
$resultPath = Join-Path $runDir 'result.json'
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8

if (-not $result.Uploaded) {
    throw "Steam upload did not complete successfully. See $appBuildLog"
}

Write-Host "`n==> Steam update completed" -ForegroundColor Green
Write-Host "    Build ID   : $buildId"
Write-Host "    Manifest ID: $manifestId"
Write-Host "    Result JSON: $resultPath"
if ($requiresManualSetLive) {
    Write-Host "`nManual action required:" -ForegroundColor Yellow
    Write-Host "    Open https://partner.steamgames.com/apps/builds/$AppId"
    Write-Host "    Find Build $buildId, select '$Branch', preview changes, and confirm Set Live."
} else {
    Write-Host "    Live branch: $Branch"
}
