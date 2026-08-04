param([string]$MainRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path)
. (Join-Path $PSScriptRoot "Common.ps1")
$layout = Get-Layout $MainRoot
Assert-Branch $layout.Release "Release"
Assert-CleanWorktree $layout.Release
$app = Join-Path $layout.Release "projects\gulugulu-app"
$targets = @((Join-Path $app "node_modules"), (Join-Path $app "dist"), (Join-Path $app "src-tauri\target"))
foreach ($target in $targets) {
    $resolvedParent = (Resolve-Path -LiteralPath (Split-Path -Parent $target)).Path
    if (-not $target.StartsWith($layout.Release, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe cleanup target: $target" }
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
& npm.cmd ci --prefix $app
if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
Write-Host "Release dependencies rebuilt."
