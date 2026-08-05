$ErrorActionPreference = "Stop"

function Get-MainRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Invoke-GitText {
    param([string]$Root, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = & git -C $Root @Arguments
    if ($LASTEXITCODE -ne 0) { throw "git $($Arguments -join ' ') failed." }
    return ($output -join "`n").Trim()
}

function Get-ConversationStateDirectory {
    param([string]$Root)
    $gitDir = Invoke-GitText $Root rev-parse --git-dir
    if (-not [IO.Path]::IsPathRooted($gitDir)) { $gitDir = Join-Path $Root $gitDir }
    return (Join-Path $gitDir "codex-conversations")
}

function Get-ConversationStatePath {
    param([string]$Root, [string]$SessionId)
    $safeId = $SessionId -replace '[^A-Za-z0-9_.-]', '_'
    return (Join-Path (Get-ConversationStateDirectory $Root) "$safeId.json")
}

function Get-RepositoryFingerprint {
    param([string]$Root)
    $status = @(& git -C $Root status --porcelain=v1 --untracked-files=all)
    if ($LASTEXITCODE -ne 0) { throw "Unable to read repository status." }
    $entries = foreach ($line in $status) {
        if (-not $line) { continue }
        $rawPath = $line.Substring([Math]::Min(3, $line.Length)).Trim('"')
        if ($rawPath -match ' -> ') { $rawPath = ($rawPath -split ' -> ')[-1].Trim('"') }
        $absolute = Join-Path $Root $rawPath
        $hash = if (Test-Path -LiteralPath $absolute -PathType Leaf) {
            (Get-FileHash -Algorithm SHA256 -LiteralPath $absolute).Hash
        } else { "<missing>" }
        "$line`t$hash"
    }
    $payload = (@($entries) -join "`n")
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '') }
    finally { $sha.Dispose() }
}

function ConvertTo-ModelTag {
    param([Parameter(Mandatory = $true)][string]$Model)
    $tag = $Model.ToUpperInvariant() -replace '[^A-Z0-9.]', ''
    if (-not $tag) { throw "Unable to derive a model tag from '$Model'." }
    return $tag
}

function Read-ConversationState {
    param([string]$Root, [string]$SessionId)
    $path = Get-ConversationStatePath $Root $SessionId
    if (-not (Test-Path -LiteralPath $path)) { throw "Conversation state was not found for session '$SessionId'. Start a new Codex conversation after trusting the project hooks." }
    return (Get-Content -Raw -LiteralPath $path | ConvertFrom-Json)
}

function Test-ChineseSummary {
    param([string]$Summary)
    return ($Summary -match '[\p{IsCJKUnifiedIdeographs}]' -and $Summary -notmatch "[`r`n]" -and $Summary.Length -le 50)
}

function Get-ConversationPullRequest {
    param([string]$Root, [string]$Branch)
    $json = & gh pr list --repo (Invoke-GitText $Root remote get-url origin) --head $Branch --base main --state open --json number,title,body,isDraft,url,headRefName,baseRefName
    if ($LASTEXITCODE -ne 0) { throw "Unable to query GitHub pull requests." }
    $items = @($json | ConvertFrom-Json)
    if ($items.Count -eq 0) { return $null }
    if ($items.Count -gt 1) { throw "More than one open PR exists for '$Branch'." }
    return $items[0]
}

function Test-PullRequestBody {
    param([string]$Body)
    if (-not $Body) { return $false }
    $headings = @(
        ('"\u8be6\u7ec6\u8bf4\u660e"' | ConvertFrom-Json),
        ('"\u9a8c\u8bc1\u7ed3\u679c"' | ConvertFrom-Json),
        ('"\u98ce\u9669\u4e0e\u5907\u6ce8"' | ConvertFrom-Json)
    ) | ForEach-Object { "## $_" }
    foreach ($heading in $headings) {
        $pattern = '(?ms)^' + [regex]::Escape($heading) + '\s*\r?\n(?<content>.*?)(?=^## |\z)'
        $match = [regex]::Match($Body, $pattern)
        if (-not $match.Success -or -not $match.Groups['content'].Value.Trim()) { return $false }
    }
    return $true
}
