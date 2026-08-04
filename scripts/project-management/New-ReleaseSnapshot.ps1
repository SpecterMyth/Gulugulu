param(
    [string]$MainRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
    [string]$SourceRevision = "main",
    [switch]$SkipTests
)
. (Join-Path $PSScriptRoot "Common.ps1")
$layout = Get-Layout $MainRoot
$manifest = Get-Content -LiteralPath $layout.Manifest -Raw | ConvertFrom-Json
$sourceSha = (& git -C $layout.Main rev-parse "$SourceRevision^{commit}").Trim()
if ($LASTEXITCODE -ne 0) { throw "Invalid source revision: $SourceRevision" }

Assert-Branch $layout.Release "Release"
Assert-CleanWorktree $layout.Release

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("gulugulu-release-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$snapshotCommitted = $false
try {
    $archive = Join-Path $tempRoot "snapshot.tar"
    & git -C $layout.Main archive --format=tar --output=$archive $sourceSha -- @($manifest.include)
    if ($LASTEXITCODE -ne 0) { throw "Unable to archive the release allowlist." }
    tar -xf $archive -C $tempRoot
    Remove-Item -LiteralPath $archive

    Invoke-Git $layout.Release @("rm", "-r", "--ignore-unmatch", ".")
    Get-ChildItem -LiteralPath $tempRoot -Force | Copy-Item -Destination $layout.Release -Recurse -Force

    $allFiles = Get-ChildItem -LiteralPath $layout.Release -File -Recurse -Force |
        Where-Object { $_.FullName -notmatch '[\\/]\.git([\\/]|$)' }
    foreach ($file in $allFiles) {
        $relative = $file.FullName.Substring($layout.Release.Length + 1).Replace('\', '/')
        foreach ($prefix in $manifest.forbiddenPrefixes) {
            if ($relative.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Forbidden release path: $relative" }
        }
        if ($manifest.forbiddenNames -contains $file.Name -or $file.Name -like ".env.*") { throw "Forbidden release file: $relative" }
        if ($file.Length -gt 95MB -and $relative -notmatch '\.(dll|dylib|so)$') { throw "Oversized non-LFS release file: $relative" }
    }

    Invoke-Git $layout.Release @("add", "--all")
    & git -C $layout.Release lfs fsck
    if ($LASTEXITCODE -ne 0) { throw "Git LFS validation failed." }

    if ($SkipTests) {
        $candidateTree = (& git -C $layout.Release write-tree).Trim()
        Write-Host "Release candidate validated without tests; no commit created. Tree: $candidateTree"
        return
    }
    else {
        $app = Join-Path $layout.Release "projects\gulugulu-app"
        & npm.cmd ci --prefix $app
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
        & npm.cmd run build --prefix $app
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
        & cargo build --locked --manifest-path (Join-Path $app "src-tauri\Cargo.toml")
        if ($LASTEXITCODE -ne 0) { throw "Cargo build failed." }
        & cargo test --locked --manifest-path (Join-Path $app "src-tauri\Cargo.toml")
        if ($LASTEXITCODE -ne 0) { throw "Cargo tests failed." }
    }

    $tree = (& git -C $layout.Release write-tree).Trim()
    $version = (Get-Content (Join-Path $layout.Release "projects\gulugulu-app\package.json") -Raw | ConvertFrom-Json).version
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $metadata = [ordered]@{
        schemaVersion = 1
        sourceMain = $sourceSha
        version = $version
        treeBeforeMetadata = $tree
        verifiedAt = $stamp
        tests = @("npm ci", "npm run build", "cargo build --locked", "cargo test --locked")
    } | ConvertTo-Json -Depth 3
    Set-Content -LiteralPath (Join-Path $layout.Release ".release-metadata.json") -Value $metadata -Encoding UTF8
    Invoke-Git $layout.Release @("add", ".release-metadata.json")
    $tree = (& git -C $layout.Release write-tree).Trim()
    $message = "Release snapshot v$version`n`nSource-main: $sourceSha`nTree: $tree`nVerified: $stamp"
    & git -C $layout.Release diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host "Release already matches source snapshot $sourceSha"; return }
    & git -C $layout.Release commit -m $message
    if ($LASTEXITCODE -ne 0) { throw "Unable to commit Release snapshot." }
    $snapshotCommitted = $true
    Write-Host "Release snapshot created from $sourceSha with tree $tree"
}
finally {
    if (-not $snapshotCommitted) {
        & git -C $layout.Release reset --hard HEAD | Out-Null
        & git -C $layout.Release clean -fdx | Out-Null
    }
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
