param(
    [string]$MainRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
    [switch]$Push
)
. (Join-Path $PSScriptRoot "Common.ps1")
$layout = Get-Layout $MainRoot
Assert-Branch $layout.Release "Release"
Assert-Branch $layout.SteamOnline "SteamOnline"
Assert-CleanWorktree $layout.Release
Assert-CleanWorktree $layout.SteamOnline
if (-not (Test-Path -LiteralPath (Join-Path $layout.Release ".release-metadata.json"))) {
    throw "Release has no verified snapshot metadata; promotion is forbidden."
}

$releaseSha = (& git -C $layout.Release rev-parse HEAD).Trim()
Invoke-Git $layout.SteamOnline @("merge", "--ff-only", $releaseSha)
if ((Get-TreeHash $layout.Release) -ne (Get-TreeHash $layout.SteamOnline)) { throw "Release and SteamOnline trees differ." }
if ($Push) { Invoke-Git $layout.SteamOnline @("push", "origin", "SteamOnline") }
Write-Host "SteamOnline now matches Release at $releaseSha"
