$ErrorActionPreference = "Stop"

function Get-Layout {
    param([string]$MainRoot)
    $main = (Resolve-Path -LiteralPath $MainRoot).Path
    $container = Split-Path -Parent $main
    [pscustomobject]@{
        Main = $main
        Container = $container
        Release = Join-Path $container "Release"
        SteamOnline = Join-Path $container "SteamOnline"
        Manifest = Join-Path $main "release\snapshot-manifest.json"
    }
}

function Invoke-Git {
    param([string]$WorkTree, [string[]]$Arguments)
    & git -C $WorkTree @Arguments
    if ($LASTEXITCODE -ne 0) { throw "git $($Arguments -join ' ') failed in $WorkTree" }
}

function Assert-CleanWorktree {
    param([string]$WorkTree)
    $dirty = & git -C $WorkTree status --porcelain
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw "Worktree must be clean: $WorkTree" }
}

function Assert-Branch {
    param([string]$WorkTree, [string]$Expected)
    $actual = (& git -C $WorkTree branch --show-current).Trim()
    if ($actual -ne $Expected) { throw "Expected branch '$Expected' in $WorkTree, found '$actual'." }
}

function Get-TreeHash {
    param([string]$WorkTree, [string]$Revision = "HEAD")
    (& git -C $WorkTree rev-parse "$Revision^{tree}").Trim()
}
