param([string]$MainRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path)
. (Join-Path $PSScriptRoot "Common.ps1")
$layout = Get-Layout $MainRoot

$mainBranch = (& git -C $layout.Main branch --show-current).Trim()
if ($mainBranch -ne "main" -and $mainBranch -notlike "codex/*") {
    throw "The main workspace must be on main or a codex/* conversation branch; found '$mainBranch'."
}

foreach ($branch in @("Release", "SteamOnline")) {
    & git -C $layout.Main show-ref --verify --quiet "refs/heads/$branch"
    if ($LASTEXITCODE -ne 0) { Invoke-Git $layout.Main @("branch", $branch, $mainBranch) }
}

$registered = ((& git -C $layout.Main worktree list --porcelain) -join "`n").Replace('\', '/')
if ($registered -notmatch [regex]::Escape($layout.Release.Replace('\', '/'))) {
    if (Test-Path -LiteralPath $layout.Release) { throw "Unregistered path already exists: $($layout.Release)" }
    Invoke-Git $layout.Main @("worktree", "add", $layout.Release, "Release")
}
if ($registered -notmatch [regex]::Escape($layout.SteamOnline.Replace('\', '/'))) {
    if (Test-Path -LiteralPath $layout.SteamOnline) { throw "Unregistered path already exists: $($layout.SteamOnline)" }
    Invoke-Git $layout.Main @("worktree", "add", $layout.SteamOnline, "SteamOnline")
}

$launcher = @"
@echo off
if not exist "%~dp0Release\.release-metadata.json" (
  echo Release has no verified snapshot. Build and test one from main first.
  pause
  exit /b 1
)
call "%~dp0Release\start.bat"
"@
Set-Content -LiteralPath (Join-Path $layout.Container "start.bat") -Value $launcher -Encoding ASCII
Write-Host "Workspaces ready under $($layout.Container)"
