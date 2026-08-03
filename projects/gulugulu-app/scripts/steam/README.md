# SteamPipe depot pipeline — Gulugulu (App 4956830 · Depot 4956831)

Uploads a playable Windows build so the last release-checklist item
(**已配置至少一个生成版本 / "at least one build configured"**) turns green.

## Files
| File | Purpose |
|---|---|
| `app_build_4956830.vdf` | Build manifest (App 4956830 → Depot 4956831). `SetLive` is empty → uploading does **not** publish to any branch. |
| `depot_build_4956831.vdf` | Depot content map (ships everything in `content\`). |
| `installscript.vdf` | R2 WebView2 fallback (optional; off by default — see below). |
| `stage_and_build.ps1` | Builds the release and stages `content\` (Gulugulu.exe + steam_api64.dll). |
| `content\`, `output\` | Generated (gitignored). |

## One-command update

From `projects\gulugulu-app`:

```powershell
npm run steam:update
```

You can also run `scripts\steam\update_steam.cmd`. The first SteamCMD login may ask
for the account password and Steam Guard approval in the console. Later runs can reuse
the cached login. The script builds the current workspace, verifies the two-file
Windows depot, creates a local audit ZIP, uploads it, and writes Build/Manifest IDs
to `scripts\steam\output\publish-*\result.json`. Valve does not allow SteamCMD to
automatically set the public `default` branch live, so after a successful upload you
must select the new Build on the Steamworks Builds page and manually promote it to
`default`. Beta branches passed with `-Branch` can still be set live automatically.

Useful options:

```powershell
# Include Rust release tests before publishing
powershell -ExecutionPolicy Bypass -File scripts\steam\update_steam.ps1 -RunTests

# Build/package only; do not contact Steam
powershell -ExecutionPolicy Bypass -File scripts\steam\update_steam.ps1 -BuildOnly
```

## Manual steps

**1. Build + stage (Claude can run this):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\steam\stage_and_build.ps1
```
Produces `content\Gulugulu.exe` + `content\steam_api64.dll`.

**2. Upload (👤 YOU — needs your Steam login + Steam Guard 2FA):**
Get steamcmd (https://developer.valvesoftware.com/wiki/SteamCMD), then:
```
steamcmd +login <steamAccount> +run_app_build "<repo>\projects\gulugulu-app\scripts\steam\app_build_4956830.vdf" +quit
```
The first login prompts for your password + Steam Guard code (must be you). After it
succeeds, credentials cache and re-uploads can be automated.

**3. After upload:** the build appears on the partner **Builds** page
(https://partner.steamgames.com/apps/builds/4956830). Set it live on a branch,
then the landing checklist's build item goes green → you can submit the build for review.

## WebView2 (R2, optional fallback)
The Tauri app needs the Edge WebView2 runtime — preinstalled on most Win10/11, and on
Valve's review machines, so the first build ships without it. To bundle the fallback:
1. Download the evergreen bootstrapper (`MicrosoftEdgeWebview2Setup.exe`, ~2 MB, free
   Microsoft redist): https://go.microsoft.com/fwlink/p/?LinkId=2124703
2. Copy it into `content\`.
3. Uncomment `"InstallScript" "installscript.vdf"` in `depot_build_4956831.vdf`.
