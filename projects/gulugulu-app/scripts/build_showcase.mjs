// 把 render_customrig 渲染出的 8 态精灵 SVG + 打工粒子 + sprites.css 组装成一张
// 可交互 showcase HTML（内联动画样式，浏览器里实时播放）。
// 用法：node scripts/build_showcase.mjs <svgDir> <outHtml>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , svgDir, outHtml] = process.argv;
const spritesCss = readFileSync(new URL("../src/sprites/sprites.css", import.meta.url), "utf8");

const STATES = [
  ["idle", "待机", "呼吸 · 眨眼"],
  ["moving", "移动", "侧视 · 迈步走"],
  ["working", "打工", "挥臂 · 用力 ><"],
  ["success", "庆祝", "跳跃 · 星星眼"],
  ["fed", "进食", "喂食 · 咀嚼"],
  ["thinking", "思考", "上瞟 · 思考点"],
  ["error", "出错", "蚊香眼 · 汗滴"],
  ["sleeping", "睡觉", "趴卧 · Zzz"],
];

const frames = STATES.map(([s]) => {
  const svg = readFileSync(join(svgDir, `turtle__${s}.svg`), "utf8").replace(/<\?xml[^>]*>/, "");
  return `<div class="frame${s === "idle" ? " is-active" : ""}" data-state="${s}">${svg}</div>`;
}).join("\n");

const pills = STATES.map(
  ([s, zh, note]) =>
    `<button class="pill${s === "idle" ? " is-active" : ""}" data-state="${s}" aria-pressed="${s === "idle"}"><span class="pill-zh">${zh}</span><span class="pill-note">${note}</span></button>`,
).join("\n");

const fx = [0, 1, 2]
  .map((i) => `<div class="chip" style="--d:${i * 0.4}s">${readFileSync(join(svgDir, `turtle__fx${i}.svg`), "utf8")}</div>`)
  .join("\n");

const html = `<title>晶甲龟 · 专属 rig 样板</title>
<style>
:root{
  --paper:#EEEADB; --panel:#F8F5EC; --stage:#E4EDE2; --stage-2:#D6E4D6;
  --ink:#322619; --muted:#8C7F69; --line:#E0D9C6;
  --jade:#4FA97C; --gold:#D89626; --pink:#D9567F; --shadow:rgba(50,38,25,.14);
}
@media (prefers-color-scheme:dark){
  :root{
    --paper:#1D1A13; --panel:#272216; --stage:#2A312A; --stage-2:#222a22;
    --ink:#F0EAD8; --muted:#A99C82; --line:#39321F;
    --jade:#6CC79A; --gold:#F2B848; --pink:#EC7C9C; --shadow:rgba(0,0,0,.4);
  }
}
:root[data-theme="light"]{
  --paper:#EEEADB; --panel:#F8F5EC; --stage:#E4EDE2; --stage-2:#D6E4D6;
  --ink:#322619; --muted:#8C7F69; --line:#E0D9C6;
  --jade:#4FA97C; --gold:#D89626; --pink:#D9567F; --shadow:rgba(50,38,25,.14);
}
:root[data-theme="dark"]{
  --paper:#1D1A13; --panel:#272216; --stage:#2A312A; --stage-2:#222a22;
  --ink:#F0EAD8; --muted:#A99C82; --line:#39321F;
  --jade:#6CC79A; --gold:#F2B848; --pink:#EC7C9C; --shadow:rgba(0,0,0,.4);
}
*{box-sizing:border-box} body{margin:0}
.wrap{
  min-height:100%; display:flex; justify-content:center; align-items:flex-start;
  padding:clamp(20px,5vw,56px) 18px;
  background:radial-gradient(120% 80% at 50% -8%, color-mix(in oklab, var(--jade) 12%, var(--paper)) 0%, var(--paper) 60%);
  color:var(--ink);
  font-family:"Segoe UI Rounded","SF Pro Rounded",ui-rounded,"Nunito",system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased;
}
.card{
  width:100%; max-width:540px; background:var(--panel); border:1px solid var(--line);
  border-radius:22px; padding:clamp(20px,4vw,32px);
  box-shadow:0 1px 0 color-mix(in oklab,var(--ink) 6%,transparent), 0 24px 48px -28px var(--shadow);
  animation:rise .5s cubic-bezier(.2,.7,.3,1) both;
}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.eyebrow{font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); font-weight:700; margin:0 0 10px}
h1{font-size:clamp(30px,7vw,40px); line-height:1; margin:0; letter-spacing:.01em; text-wrap:balance}
.subtitle{margin:10px 0 0; color:var(--muted); font-size:14px; line-height:1.5; max-width:44ch}
.tags{display:flex; gap:6px; margin:14px 0 0; flex-wrap:wrap}
.tag{font-size:12px; font-weight:600; padding:3px 10px; border-radius:999px; border:1px solid var(--line)}
.tag.grass{color:var(--jade)} .tag.water{color:#3F8FCF} .tag.hi{color:var(--gold)}
.stage{
  margin:20px 0 0; position:relative; aspect-ratio:1/.82; border-radius:16px;
  background:radial-gradient(70% 62% at 50% 46%, var(--stage) 0%, var(--stage-2) 100%);
  border:1px solid var(--line); display:grid; place-items:center; overflow:hidden;
}
.stage::after{content:""; position:absolute; left:50%; bottom:16%; width:52%; height:9%; transform:translateX(-50%); border-radius:50%; background:radial-gradient(closest-side, var(--shadow), transparent)}
.frame{position:absolute; inset:8% 0 0; display:none; place-items:center}
.frame.is-active{display:grid}
.frame svg{width:min(64%,240px); height:auto; overflow:visible}
.now{display:flex; align-items:baseline; gap:8px; justify-content:center; margin:12px 0 0; font-size:13px; color:var(--muted)}
.now b{color:var(--ink); font-size:15px}
.pills{display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:16px 0 0}
.pill{appearance:none; cursor:pointer; text-align:center; display:flex; flex-direction:column; gap:2px; align-items:center; padding:9px 4px; border-radius:12px; background:var(--paper); color:var(--ink); border:1px solid var(--line); transition:transform .12s, border-color .12s, background .12s; font-family:inherit}
.pill:hover{transform:translateY(-1px); border-color:color-mix(in oklab,var(--gold) 50%,var(--line))}
.pill:focus-visible{outline:2px solid var(--gold); outline-offset:2px}
.pill.is-active{background:color-mix(in oklab,var(--gold) 16%,var(--panel)); border-color:var(--gold)}
.pill-zh{font-weight:700; font-size:14px}
.pill-note{font-size:10.5px; color:var(--muted); line-height:1.1}
.strip{margin:22px 0 0; padding:16px 0 0; border-top:1px solid var(--line)}
.strip-h{font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); font-weight:700; margin:0 0 4px}
.strip-sub{font-size:12px; color:var(--muted); margin:0 0 12px}
.strip-sub b{color:var(--ink)}
.chips{display:flex; gap:12px; align-items:center}
.chip{width:52px; height:52px; border-radius:13px; display:grid; place-items:center; background:var(--stage); border:1px solid var(--line); animation:bob 2.4s ease-in-out infinite; animation-delay:var(--d)}
.chip svg{width:32px; height:32px}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.note{margin:20px 0 0; font-size:12.5px; line-height:1.6; color:var(--muted); background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:13px 15px}
.note b{color:var(--ink); font-weight:700}
@media (prefers-reduced-motion:reduce){.card{animation:none}.chip{animation:none}}
@media (max-width:420px){.pills{grid-template-columns:repeat(2,1fr)}}
/* ===== 内嵌 sprites.css（让精灵真正动起来）===== */
${spritesCss}
</style>

<div class="wrap">
  <main class="card">
    <p class="eyebrow">专属 RIG · 手搓概念样板</p>
    <h1>晶甲龟</h1>
    <p class="subtitle">一套数据驱动的三视图 rig（正 / 侧 / 趴）—— 龟壳剪影是参数化系统做不出的形体。全部动画由标准部件驱动，零额外成本。</p>
    <div class="tags"><span class="tag grass">● 草</span><span class="tag water">● 水</span><span class="tag hi">✦ 华丽装饰 ×4</span></div>
    <div class="stage" id="stage">${frames}</div>
    <div class="now">当前动作 · <b id="now-zh">待机</b> <span id="now-note">呼吸 · 眨眼</span></div>
    <div class="pills" id="pills">${pills}</div>
    <section class="strip">
      <p class="strip-h">专属打工粒子</p>
      <p class="strip-sub">粒子 = 工具的真实产物：这只的工具是<b>洒水壶</b> → 喷出的就是<b>水滴与水花</b>（点击打工时飞向全屏）</p>
      <div class="chips">${fx}</div>
    </section>
    <p class="note"><b>这只龟还不在你的游戏里</b>，是我手搓的一套 <b>CustomRig</b> 数据，用来验证"全 AI 手绘专属 rig"能达到的效果：真三视图、随动作变化的夸张表情、与工具强相关的专属粒子、可叠加的华丽装饰。下一步是教本地 Opus 稳定产出这种数据。</p>
  </main>
</div>

<script>
(function(){
  var pills=document.getElementById('pills');
  var frames=document.getElementById('stage').querySelectorAll('.frame');
  var nowZh=document.getElementById('now-zh'), nowNote=document.getElementById('now-note');
  var META={};
  ${JSON.stringify(STATES)}.forEach(function(r){META[r[0]]={zh:r[1],note:r[2]};});
  pills.addEventListener('click',function(e){
    var b=e.target.closest('.pill'); if(!b) return;
    var st=b.getAttribute('data-state');
    pills.querySelectorAll('.pill').forEach(function(p){var on=p===b;p.classList.toggle('is-active',on);p.setAttribute('aria-pressed',on);});
    frames.forEach(function(f){f.classList.toggle('is-active',f.getAttribute('data-state')===st);});
    nowZh.textContent=META[st].zh; nowNote.textContent='· '+META[st].note;
  });
})();
</script>
`;

writeFileSync(outHtml, html);
console.log("wrote", outHtml, `(${(html.length / 1024).toFixed(0)} kb)`);
