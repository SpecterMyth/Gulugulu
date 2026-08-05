$ErrorActionPreference = "Stop"
trap {
    $message = "Mandatory PR verification failed: $($_.Exception.Message)"
    @{ decision = 'block'; reason = $message } | ConvertTo-Json -Compress
    exit 0
}
$inputJson = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $root) { '{}' ; exit 0 }
. (Join-Path $root "scripts\project-management\ConversationPr.Common.ps1")

$statePath = Get-ConversationStatePath $root $inputJson.session_id
if (-not (Test-Path -LiteralPath $statePath)) {
    $dirty = @(& git -C $root status --porcelain=v1 --untracked-files=all)
    $ahead = [int](Invoke-GitText $root rev-list --count 'origin/main..HEAD')
    if ($dirty.Count -gt 0 -or $ahead -gt 0) {
        @{ decision = 'block'; reason = 'Repository changes exist but this session has no hook baseline. Start a new Codex conversation after trusting .codex/hooks.json.' } | ConvertTo-Json -Compress
    } else { '{}' }
    exit 0
}
$state = Read-ConversationState $root $inputJson.session_id
$currentHead = Invoke-GitText $root rev-parse HEAD
$currentFingerprint = Get-RepositoryFingerprint $root
$changed = ($currentHead -ne $state.initialHead) -or ($currentFingerprint -ne $state.initialFingerprint)
if (-not $changed) { '{}' ; exit 0 }

$failures = [Collections.Generic.List[string]]::new()
$branch = Invoke-GitText $root branch --show-current
if ($branch -notlike 'codex/*') { $failures.Add("current branch '$branch' must match codex/*") }
if ($currentFingerprint -ne $state.initialFingerprint) { $failures.Add('conversation changes remain uncommitted or pre-existing files were altered') }

if ($branch -like 'codex/*') {
    $upstreamHead = (& git -C $root rev-parse "refs/remotes/origin/$branch" 2>$null)
    if ($LASTEXITCODE -ne 0 -or ($upstreamHead -join '').Trim() -ne $currentHead) { $failures.Add('current HEAD is not pushed to origin') }
    $commitCount = [int](Invoke-GitText $root rev-list --count "origin/main..HEAD")
    if ($commitCount -ne 1) { $failures.Add("conversation branch must contain exactly one commit over origin/main; found $commitCount") }
    try { $pr = Get-ConversationPullRequest $root $branch } catch { $failures.Add($_.Exception.Message); $pr = $null }
    if (-not $pr) { $failures.Add('no open pull request targets main for the current branch') }
    else {
        $expectedPrefix = "[$($state.modelTag)]"
        if (-not $pr.isDraft) { $failures.Add('pull request must remain a draft') }
        if (-not $pr.title.StartsWith($expectedPrefix, [StringComparison]::Ordinal)) { $failures.Add("PR title must start with $expectedPrefix") }
        $summary = $pr.title.Substring([Math]::Min($expectedPrefix.Length, $pr.title.Length))
        if (-not (Test-ChineseSummary $summary)) { $failures.Add('PR title summary must be a one-line Chinese description of at most 50 characters') }
        if (-not (Test-PullRequestBody $pr.body)) { $failures.Add('PR body must contain non-empty detailed description, verification, and risk sections') }
        if ($inputJson.last_assistant_message -notmatch [regex]::Escape($pr.url)) { $failures.Add('final response must include the draft PR URL') }
    }
}

if ($failures.Count -eq 0) { '{}' ; exit 0 }
$reason = "Mandatory PR workflow is incomplete:`n- " + ($failures -join "`n- ") + "`nUse `$complete-conversation-pr and Complete-Conversation.ps1 for session $($state.sessionId), then finish with the PR URL."
@{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress
