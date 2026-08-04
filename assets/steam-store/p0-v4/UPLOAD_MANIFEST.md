# Steam upload manifest — p0-v4

English is the default language. Simplified Chinese uses the matching files from the `zh` directories.

## Capsules

Upload these universal capsule images:

| Steam slot | File | Size |
| --- | --- | --- |
| Main capsule | `capsules/main_capsule.png` | 1232×706 |
| Vertical capsule | `capsules/vertical_capsule.png` | 748×896 |
| Header capsule | `capsules/header_capsule.png` | 460×215 |
| Small capsule | `capsules/small_capsule.png` | 462×174 |

The four `*_master.png` files are review/archive masters and should not be uploaded to fixed-size Steam slots.

## Screenshots

- Default / English: upload all 13 PNG files in `screenshots/en/` in the preferred order below.
- Simplified Chinese: upload the same filenames from `screenshots/zh/` as localized replacements.

Recommended order:

1. `factory_tall_stack.png`
2. `backyard_home.png`
3. `backyard_dex.png`
4. `factory_action.png`
5. `backyard_shop.png`
6. `backyard_pits.png`
7. `backyard_market.png`
8. `backyard_notice.png`
9. `factory_loadout.png`
10. `pet_working.png`
11. `pet_menu_closeup.png`
12. `pet_sleeping.png`
13. `pet_thinking.png`

Every screenshot is 1920×1080 and comes from the actually running game. The generated wallpapers are injected behind the live game UI; the desktop icons and taskbar use the previous SVG implementation.

## Trailers

| Language | File | Duration | Factory coverage |
| --- | --- | --- | --- |
| Default / English | `trailer/gulugulu_trailer_en.mp4` | 61.067 s | 31.000 s / 50.77% |
| Simplified Chinese | `trailer/gulugulu_trailer_zh.mp4` | 62.267 s | 31.000 s / 49.79% |

Both trailers are H.264 1920×1080 at 30 fps with stereo AAC 48 kHz audio. They retain the accepted classic desktop/large animated pet opening for seconds 0–3. The 31-second Factory flow is distributed as follows: multi-species reward gameplay at 3–9, hiring at 15–22, shift-end card shop at 28–35, dense multi-species gameplay at 41–48, and a final reward/drop beat at 53–57. Gameplay scenes rotate through ten pet species and use the real game's coin waves, impact flashes, strike rings, confetti, and purchase feedback. Carrier flight, reload, pet falling, and landing run at approximately 3× speed. Music and reward particles remain at 1.0×, with no audio tempo/speed filter.

## QA

- English screenshots: 13/13; Chinese screenshots: 13/13.
- Capsule dimensions checked against the four Steam slots.
- Final trailers decoded end-to-end with zero FFmpeg errors.
- Video/audio duration delta is under 1 ms in both final trailers.
- Final trailer contact sheet: `qa/final_full_flow_contact_sheet.jpg`.

## Steamworks draft status (2026-08-04)

- Capsules and localized screenshots: uploaded by the publisher.
- English trailer public title: `Gulugulu — Office Stack-Up Gameplay Trailer`.
- Simplified Chinese trailer public title: `Gulugulu：《职场叠叠乐》玩法宣传片`.
- Both trailers are categorized as Gameplay, visible on the store page, shown before screenshots, and marked suitable for all ages.
- The Simplified Chinese trailer is grouped under the English base trailer so Steam can select the matching language automatically.
- Country restrictions were cleared from both trailer variants; language selection now works globally instead of being hard-limited to `CN` versus non-`CN`.
- The description draft adds a Steam Workshop feature banner with localized labels: `Share Your Own Gulu Creations on Steam Workshop` / `在 Steam 创意工坊分享你的咕噜作品`.
- Both final trailer MP4 files were uploaded and converted successfully by Steam.
- Steam CDN verification: the English DASH presentation is 61.0 seconds; the Simplified Chinese DASH presentation is 62.2 seconds. Both manifests and generated microtrailers return successfully.
- The store-page draft is ready for final publisher review. Do not publish it without explicit approval.
