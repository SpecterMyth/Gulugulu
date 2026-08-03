# Gulugulu Steam Store P0 v2

This folder contains the P0 store-page refresh prepared for the Early Access launch. The launch date is intentionally unchanged.

## Short descriptions

English:

> An AI-aware desktop pet that reacts to Claude Code and Codex, eats their output tokens, and helps you hatch 63 creatures. Then draft 3–10 favorites into Office Stack-Up, a 20-shift physics roguelite of elemental desks, KPI targets, and upgrades. No AI required.

Simplified Chinese:

> 一款会对 Claude Code 与 Codex 实时做出反应的桌面宠物游戏。用编程 Agent 消耗的输出 Token 喂养咕噜，点击赚金币、孵蛋、融合并收集 63 种生物；再从收藏中挑选 3–10 只，投入完整 20 回合的《职场叠叠乐》物理 Roguelite。连接六种元素办公桌、完成 KPI、购买升级，在摇摇欲坠的办公室里把团队堆到下班。无需 AI 也能完整游玩；AI 功能只提供额外反应和本地变种，不会收集 API Key。

## Published top-20 tag order

1. Idler
2. Creature Collector
3. Life Sim
4. Management
5. Roguelite
6. Artificial Intelligence
7. Resource Management
8. Animals
9. Rogue-like
10. Cute
11. 2D
12. Casual
13. Simulation
14. Colorful
15. Cartoon
16. Singleplayer
17. Early Access
18. Indie
19. Relaxing
20. Physics

The August 3 Steamworks tag refresh added `Physics` and `Relaxing`, retained `Early Access` and `Indie`, and removed `Procedural Generation` and `Inventory Management`. Steam's tag wizard did not expose a `Desktop Companion` partner tag for this app.

## Upload order

Capsules:

- `main_capsule_v2.png` — 1232 x 706
- `header_capsule_v2.png` — 920 x 430
- `small_capsule_v2.png` — 462 x 174
- `vertical_capsule_v2.png` — 748 x 896

Screenshots (put these first, followed by the existing supporting screenshots):

1. `screenshots/01_ai_desktop_english.png` / `01_ai_desktop_schinese.png`
2. `screenshots/02_office_stackup_english.png` / `02_office_stackup_schinese.png`
3. `screenshots/03_collection_english.png` / `03_collection_schinese.png`

Trailers:

- `gulugulu_trailer_en_v2.mp4`
- `gulugulu_trailer_zh_v2.mp4`

Both trailers are H.264/AAC, 1920 x 1080, 30 fps, with fast-start metadata. The first six seconds now show the AI-aware desktop pet, token interaction, and Office Stack-Up instead of delaying the core gameplay hook.

## Asset provenance

The capsule background was generated as a background layer only. The Gulugulu logo, mascot, and all gameplay screenshots/video remain original project assets or captured gameplay. `scripts/build_steam_p0_assets.py` rebuilds the capsules, and `scripts/reframe_steam_trailers.py` rebuilds the trailer recuts.

## Visibility timing

Early Access launch visibility is automatic. A manual Update Visibility Round is not available on launch day; Steam requires at least two weeks after the Early Access release before the first round can be used. Based on the August 18 launch in Singapore time, treat approximately September 1–2 as the earliest eligibility window and reserve it for a substantive update.
