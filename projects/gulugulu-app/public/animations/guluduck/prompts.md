# Guluduck Imagegen Animation Assets

These assets are generated from dedicated Imagegen pose sheets stored in `pose_sheets/`.
Each sheet is sliced by its declared grid, chroma-keyed from #00ff00, normalized to 768x768 frames, and packed into a single-row WebP spritesheet.

## idle_normal

- Purpose: 普通待机，轻微呼吸、眨眼、呆毛弹动
- Pose sheet: `pose_sheets/idle_normal.png`
- Grid: 4x3
- Frames: 12
- FPS: 8
- Loop: true
- Imagegen prompt summary: 12-frame idle pose sheet: closed bill, slow breathing, tiny weight shift, wing wiggle, blink, feather bounce.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## blink

- Purpose: 独立眨眼，可叠加或短触发
- Pose sheet: `pose_sheets/blink.png`
- Grid: 6x1
- Frames: 6
- FPS: 12
- Loop: false
- Imagegen prompt summary: 6-frame blink pose sheet: open, half, closed, relaxed, half, open.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## sleep

- Purpose: sleep loop: closed-eye breathing with tiny head and feather motion
- Pose sheet: `pose_sheets/sleep.png`
- Grid: 4x3
- Frames: 12
- FPS: 8
- Loop: true
- Imagegen prompt summary: 12-frame sleeping loop: closed eyes, slow breathing squash-and-stretch, tiny head bob, tucked wings, feather bounce.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## walk

- Purpose: 小脚啪嗒走路，身体左右摇
- Pose sheet: `pose_sheets/walk.png`
- Grid: 8x1
- Frames: 8
- FPS: 10
- Loop: true
- Imagegen prompt summary: 8-frame right-facing waddle walk cycle with alternating feet.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## turn_around

- Purpose: 左右朝向切换
- Pose sheet: `pose_sheets/turn_around.png`
- Grid: 5x2
- Frames: 10
- FPS: 12
- Loop: false
- Imagegen prompt summary: 10-frame turn-around: front, three-quarter, side, back, and return.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## back_climb

- Purpose: 背面上下爬动，自主纵向位移时使用
- Pose sheet: `pose_sheets/back_climb.png`
- Grid: 4x4
- Frames: 16
- FPS: 12
- Loop: true
- Imagegen prompt summary: 16-frame back-facing climb/scoot loop: alternating feet, wing press, body squash, neckerchief bounce.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## happy_dance

- Purpose: 开心小碎步转圈/扑翅
- Pose sheet: `pose_sheets/happy_dance.png`
- Grid: 4x4
- Frames: 16
- FPS: 12
- Loop: false
- Imagegen prompt summary: 16-frame happy dance: tiny spin, flapping wings, laughing beak.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## confused

- Purpose: 困惑歪头、眨眼
- Pose sheet: `pose_sheets/confused.png`
- Grid: 4x3
- Frames: 12
- FPS: 10
- Loop: false
- Imagegen prompt summary: 12-frame confused pose sheet: head tilts, wing on beak, puzzled bounce.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## scared_backstep

- Purpose: 惊吓后退、脚抬起
- Pose sheet: `pose_sheets/scared_backstep.png`
- Grid: 7x2
- Frames: 14
- FPS: 12
- Loop: false
- Imagegen prompt summary: 14-frame scared backstep: wide eyes, open beak, raised wings, retreat.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## angry_backturn

- Purpose: 生气背对、嘴硬沉默
- Pose sheet: `pose_sheets/angry_backturn.png`
- Grid: 4x3
- Frames: 12
- FPS: 10
- Loop: false
- Imagegen prompt summary: 12-frame angry back-turn: pout, turn away, stubborn back-facing wiggle.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## agent_thinking

- Purpose: agent 思考时认真点头
- Pose sheet: `pose_sheets/agent_thinking.png`
- Grid: 4x3
- Frames: 12
- FPS: 8
- Loop: true
- Imagegen prompt summary: 12-frame agent thinking: serious nodding, wing on chin, fake expertise.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## agent_success

- Purpose: agent 成功时骄傲庆祝
- Pose sheet: `pose_sheets/agent_success.png`
- Grid: 7x2
- Frames: 14
- FPS: 12
- Loop: false
- Imagegen prompt summary: 14-frame success celebration: proud nod, hop, wing spread, smug landing.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## eat

- Purpose: token 投喂时啄食/咀嚼
- Pose sheet: `pose_sheets/eat.png`
- Grid: 4x4
- Frames: 16
- FPS: 10
- Loop: false
- Imagegen prompt summary: 16-frame eating: sees snack, pecks crumbs, cheek puff, swallow, satisfied.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.

## pet_head

- Purpose: 被摸头，先嘴硬后舒服
- Pose sheet: `pose_sheets/pet_head.png`
- Grid: 7x2
- Frames: 14
- FPS: 10
- Loop: false
- Imagegen prompt summary: 14-frame pet reaction: stubborn, then happy closed-eye comfort.
- Shared prompt constraints: round yellow Guluduck, orange bill and feet, red neckerchief, three head feathers, cute painterly sprite style, #00ff00 chroma-key background, no text, no watermark.
