---
name: gulugulu-avatar-imagegen
description: Generate Gulugulu custom desktop-pet image assets from an uploaded reference image. Use when Codex is invoked inside a Gulugulu avatar-gen job directory to create an original clean mascot design and a 16-frame idle pose sheet for the custom pet.
---

# Gulugulu Avatar Imagegen

Generate only the project-bound assets requested by the current job. Stay inside the current working directory and do not edit repository source files.

## Required Inputs

- One or two reference images are attached to the Codex invocation.
  - **One image** → normalize it into a single original mascot.
  - **Two images** → this is a **fusion**: the first is parent A, the second is parent B. Design ONE new original creature that fuses them (see Fusion Mode below).
- The current working directory is the avatar generation job directory.

## Required Outputs

Write these files:

- `standard-design.png`: one clean full-body character design on a flat `#00ff00` chroma-key background.
- `pose_sheets/idle_normal.png`: a `4 x 4` grid pose sheet containing exactly 16 idle animation frames.
- `generation-result.json`: UTF-8 JSON with:

```json
{
  "name": "Short original pet name",
  "summary": "One-sentence description",
  "visualTraits": ["trait 1", "trait 2", "trait 3"],
  "stylePrompt": "Prompt used for the generated design",
  "outputs": {
    "standardDesign": "standard-design.png",
    "idlePoseSheet": "pose_sheets/idle_normal.png"
  }
}
```

## Style Rules

- Convert any uploaded image into an original cute desktop pet mascot.
- Use a clean, Japanese (kawaii) monster-companion inspired style without copying Pokemon, Digimon, or any named copyrighted character.
- Preserve only broad visual inspiration from the source image: silhouette idea, dominant colors, notable accessories, texture motifs, or personality cues.
- **Keep it as simple as a Pokemon.** Use a clean rounded silhouette, flat solid colors, one strong outline, and at most one or two simple accent shapes. Let shape and color do the work.
- Do NOT add ornamentation: no jewelry, gems, crystals, coral, filigree, lace, patterns, engravings, glitter, sparkles, bubbles, floating particles, auras, or glow.
- Do not include text, logos, watermarks, UI, labels, captions, shadows, reflections, props outside the character, decorative frame/border, or background scenery.

## Fusion Mode (two attached images)

When two reference images are attached, design ONE brand-new original creature that is a believable fusion of the two:

- It must be a single coherent creature — not two creatures side by side, and not one holding another.
- Take the overall body shape / silhouette from one parent, and clearly graft 1-2 signature features from the other (its main color, plus one standout part such as ears, horns, tail, wings, or a crest, and one accent color).
- Apply the same Pokemon-level simplicity rules above: flat colors, clean silhouette, minimal decoration.

## Transparency Setup

The generated images must use a removable chroma-key background:

- Use a perfectly flat solid `#00ff00` background.
- Do not use `#00ff00` anywhere in the pet.
- No cast shadow, contact shadow, gradients, floor plane, texture, lighting variation, or glow in the background.
- Keep generous padding around the pet in every cell.

## Idle Pose Sheet

Create `pose_sheets/idle_normal.png` as a single image:

- Grid: 4 columns by 4 rows.
- Frames: exactly 16, reading left-to-right then top-to-bottom.
- Intended playback: a smooth, calm idle LOOP — think gentle breathing, not a dance.
- **Consistency (most important):** it is the exact same character in every cell — identical shapes, colors, outline weight, and proportions. Keep it locked in the SAME position, at the SAME size, facing the SAME way in every cell. Do not move, pan, zoom, rotate, flip, or resize the character or the camera between cells.
- **Small steps:** neighboring frames must look almost the same, differing only by a tiny amount, so the change from each frame to the next is small and even (ease-in, ease-out). No jumps, popping, or shaking.
- **Motion:** animate ONLY subtle secondary motion — a slow breathing rise-and-fall (small squash and stretch), a gentle head bob, one slow blink somewhere in the middle of the loop, and a slight sway of soft parts (ears, tail, hair, cloth). Keep the amplitude small. The feet/base stay planted in the same spot.
- **Seamless loop:** frame 16 is the in-between just before frame 1, so frame 16 -> frame 1 is the same tiny step as frame 1 -> frame 2. Frame 16 looks almost identical to frame 1 (nearly matching pose, position, and scale) but is NOT an exact duplicate.
- Keep the character centered and fully visible in each cell.

## Failure

If image generation tools are unavailable or you cannot write the requested files, write `generation-failure.json` with an `error` string explaining the blocker.
