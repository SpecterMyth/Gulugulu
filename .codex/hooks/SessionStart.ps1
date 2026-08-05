$ErrorActionPreference = "Stop"
$inputJson = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $root) { exit 0 }
. (Join-Path $root "scripts\project-management\ConversationPr.Common.ps1")

$stateDirectory = Get-ConversationStateDirectory $root
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
$statePath = Get-ConversationStatePath $root $inputJson.session_id
if (Test-Path -LiteralPath $statePath) {
    $state = Read-ConversationState $root $inputJson.session_id
} else {
    $state = [ordered]@{
        sessionId = $inputJson.session_id
        model = $inputJson.model
        modelTag = ConvertTo-ModelTag $inputJson.model
        initialHead = Invoke-GitText $root rev-parse HEAD
        initialBranch = Invoke-GitText $root branch --show-current
        initialFingerprint = Get-RepositoryFingerprint $root
        startedAt = [DateTimeOffset]::UtcNow.ToString('o')
    }
    $state | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $statePath
}

$context = "Gulugulu mandatory PR workflow is active. Session ID: $($state.sessionId). Model tag: $($state.modelTag). Any repository change must be completed with scripts/project-management/Complete-Conversation.ps1 and the final answer must include the draft PR URL. Read and use the complete-conversation-pr skill."
@{
    hookSpecificOutput = @{
        hookEventName = "SessionStart"
        additionalContext = $context
    }
} | ConvertTo-Json -Depth 4 -Compress
