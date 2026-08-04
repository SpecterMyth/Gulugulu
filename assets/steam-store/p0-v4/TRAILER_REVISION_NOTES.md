# Trailer revision notes — completed

Review feedback recorded and implemented on 2026-08-04. This revision changes trailers only; approved capsules and screenshots remain untouched.

## Implemented changes

1. The first three seconds keep the accepted classic blue desktop/IDE composition, previous SVG desktop icons, and one large animated pet.
2. Seconds 3–9 now show newly recorded live Factory Stack-Up gameplay. The carrier flight, reload cadence, pet fall physics, and landing motion run at approximately 3× speed in every Factory segment. During seconds 3–6, the separately-rendered coin wave remains at normal speed and stays visible long enough to read the reward feedback.
3. The Factory flow recurs in five places and totals 31 seconds:
   - 3–9 s: rainy-night multi-species drops, mass coin flight, impact flashes, strike rings, and confetti.
   - 15–22 s: the real localized hiring screen, including candidate selection and reroll interaction.
   - 28–35 s: the real localized shift-end shop, including card rerolls, keyword details, purchases, and purchase feedback.
   - 41–48 s: dense near-overflow daylight gameplay with rotating species and chained screen FX.
   - 53–57 s: second multi-species reward/drop beat.
4. The three gameplay recordings rotate through the ten species in the rich preview save instead of repeating one carried pet. The five recordings use distinct deterministic seeds, layouts, backgrounds, and pet distributions. Recruitment, shop, physics, and FX are captured from the actual running game, not redrawn.
5. The music is laid back at 1.0× from the corresponding original English or Chinese source. Coin particles also remain at 1.0×. No `atempo` or global audio-speed filter is used.

## Runtime share

- English: 31.000 / 61.067 seconds = 50.77% Factory gameplay.
- Simplified Chinese: 31.000 / 62.267 seconds = 49.79% Factory gameplay.

## Final files

- `trailer/gulugulu_trailer_en.mp4`
- `trailer/gulugulu_trailer_zh.mp4`

The previous p0-v4 files are preserved in `trailer/archive/`.

## QA status

- Both files decode end-to-end without FFmpeg errors.
- Both are H.264, 1920×1080, 30 fps, with stereo AAC audio at 48 kHz.
- English video/audio durations: 61.066667 / 61.066000 seconds.
- Chinese video/audio durations: 62.266667 / 62.266000 seconds.
- Final review contact sheet: `qa/final_full_flow_contact_sheet.jpg`.
- Bilingual Factory-flow review sheet: `qa/factory-v4c/bilingual_flow_contact.jpg`.
- Multi-species temporal strip: `qa/factory-v4c/en_pet_rotation_strip.jpg`.

## Status

- Capsules: approved and unchanged.
- Screenshots: approved and unchanged.
- English trailer: regenerated and ready for review/upload.
- Simplified Chinese trailer: regenerated and ready for review/upload.
