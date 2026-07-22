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

## Steps

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
