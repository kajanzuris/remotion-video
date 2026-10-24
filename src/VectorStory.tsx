import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FPS = 30;
const XF = 10;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Pose = "idle" | "point" | "shock" | "sad" | "cheer" | "wave" | "walk" | "tremble" | "think";
type Card = { type: "list" | "stat" | "bars" | "tool"; title?: string; items?: string[]; value?: string; label?: string; name?: string; tagline?: string; cta?: string };
type Char = { type?: string; x: number; pose: Pose; enter?: "left" | "right"; s?: number; color?: string; flip?: boolean; walkTo?: number };
type Scn = { title: string; start: number; accent: string; bg: string; chars: Char[]; prop?: string; card?: Card };

export type VideoData = { durationInFrames: number; watermark?: string; music?: boolean; scenes: Scn[] };
export type StoryProps = { name: string; data?: VideoData };

const Limb: React.FC<{ x1: number; y1: number; x2: number; y2: number; c: string }> = ({ x1, y1, x2, y2, c }) => (
  <g strokeLinecap="round">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111" strokeWidth={32} />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={22} />
  </g>
);

const Stick: React.FC<{ pose: Pose; color: string; f: number; type?: string }> = ({ pose, color, f, type }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const breathe = Math.sin(f / 9) * 3;
  const blink = f % 90 < 4;
  let aL = 14, aR = -14, legs = 0, tilt = 0, mouth = "smile";
  if (pose === "point") { aR = -95; mouth = "open"; }
  else if (pose === "shock") { aL = 150; aR = -150; mouth = "o"; }
  else if (pose === "sad") { aL = 8; aR = -8; tilt = 12; mouth = "sad"; }
  else if (pose === "cheer") { aL = 160 + Math.sin(f / 4) * 12; aR = -160 - Math.sin(f / 4) * 12; mouth = "open"; }
  else if (pose === "wave") { aR = -150 + Math.sin(f / 3) * 25; }
  else if (pose === "walk") { legs = Math.sin(f / 4) * 28; aL = Math.sin(f / 4) * 25; aR = -Math.sin(f / 4) * 25; }
  else if (pose === "tremble") { aL = 40; aR = -40; mouth = "o"; }
  else if (pose === "think") { aR = -120; mouth = "sad"; tilt = -6; }
  const shake = pose === "tremble" ? Math.sin(f * 2.2) * 5 : 0;
  const bob = pose === "walk" ? Math.abs(Math.sin(f / 4)) * -10 : 0;
  const arm = (side: number, a: number) => (
    <Limb x1={side * 50} y1={-310 + breathe} x2={side * 50 - Math.sin(rad(a)) * 130} y2={-310 + breathe + Math.cos(rad(a)) * 130} c="#f4f1ea" />
  );
  return (
    <g transform={`translate(${shake},${bob})`}>
      <Limb x1={-22} y1={-190} x2={-22 + legs} y2={0} c="#2b2d42" />
      <Limb x1={22} y1={-190} x2={22 - legs} y2={0} c="#2b2d42" />
      <rect x={-52} y={-335 + breathe} width={104} height={150} rx={34} fill={color} stroke="#111" strokeWidth={6} />
      {type === "girl" && <polygon points="-60,-200 60,-200 88,-120 -88,-120" fill={color} stroke="#111" strokeWidth={6} />}
      {arm(-1, aL)}
      {arm(1, aR)}
      <g transform={`rotate(${tilt} 0 -340)`}>
        {type === "robot" ? (
          <g>
            <rect x={-68} y={-478 + breathe} width={136} height={136} rx={20} fill="#cfd8dc" stroke="#111" strokeWidth={6} />
            <line x1={0} y1={-478 + breathe} x2={0} y2={-520 + breathe} stroke="#111" strokeWidth={6} />
            <circle cx={0} cy={-528 + breathe} r={9} fill="#ff6b6b" />
          </g>
        ) : (
          <circle cx={0} cy={-410 + breathe} r={72} fill="#f4f1ea" stroke="#111" strokeWidth={6} />
        )}
        {type === "girl" && <path d={`M-74 ${-410 + breathe} Q-80 ${-500 + breathe} 0 ${-495 + breathe} Q80 ${-500 + breathe} 74 ${-410 + breathe} L68 ${-340 + breathe} Q60 ${-440 + breathe} 0 ${-446 + breathe} Q-60 ${-440 + breathe} -68 ${-340 + breathe} Z`} fill="#3a1f0d" />}
        {type === "boss" && <g fill="#222"><rect x={-84} y={-490 + breathe} width={168} height={26} rx={10} /><rect x={-52} y={-536 + breathe} width={104} height={52} rx={10} /></g>}
        {blink ? (
          <g stroke="#111" strokeWidth={5}><line x1={-34} y1={-420 + breathe} x2={-14} y2={-420 + breathe} /><line x1={14} y1={-420 + breathe} x2={34} y2={-420 + breathe} /></g>
        ) : (
          <g fill="#111"><circle cx={-24} cy={-420 + breathe} r={7} /><circle cx={24} cy={-420 + breathe} r={7} /></g>
        )}
        {mouth === "smile" && <path d={`M-24 ${-390 + breathe} Q0 ${-366 + breathe} 24 ${-390 + breathe}`} stroke="#111" strokeWidth={5} fill="none" />}
        {mouth === "sad" && <path d={`M-22 ${-372 + breathe} Q0 ${-394 + breathe} 22 ${-372 + breathe}`} stroke="#111" strokeWidth={5} fill="none" />}
        {mouth === "open" && <ellipse cx={0} cy={-382 + breathe} rx={15} ry={(10 + Math.abs(Math.sin(f / 3)) * 10)} fill="#111" />}
        {mouth === "o" && <circle cx={0} cy={-380 + breathe} r={13} fill="#111" />}
        {pose === "sad" && <circle cx={30} cy={-405 + breathe + (f % 40)} r={6} fill="#6ec6ff" opacity={1 - (f % 40) / 40} />}
      </g>
    </g>
  );
};

const SKY: Record<string, [string, string]> = {
  night: ["#050914", "#16213e"],
  dusk: ["#1b1535", "#5b3a6e"],
  dawn: ["#ff9a5a", "#ffd9a0"],
  stage: ["#000000", "#0a0a12"],
  crowd: ["#0a1226", "#24344f"],
  room: ["#2b2d42", "#3d405b"],
  office: ["#dee2e6", "#adb5bd"],
  day: ["#8ecae6", "#e0f4ff"],
};
const GROUND: Record<string, string> = { dawn: "#2d6a4f", day: "#6a994e", room: "#5c4033", office: "#6c757d" };

const Bg: React.FC<{ type: string; f: number; p: number }> = ({ type, f, p }) => {
  const [c1, c2] = SKY[type] || SKY.night;
  const pan = -p * 60;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute" }}>
      <defs>
        <linearGradient id={"g" + type} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width={1080} height={1920} fill={`url(#g${type})`} />
      {["night", "dusk", "crowd"].includes(type) &&
        Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={(i * 97) % 1080} cy={(i * 53) % 800} r={2 + (i % 3)} fill="#fff" opacity={0.3 + 0.4 * Math.abs(Math.sin(f / 20 + i))} />
        ))}
      {type === "dawn" && <circle cx={540 + pan * 0.5} cy={interpolate(f, [0, 90], [1250, 880], clamp)} r={170} fill="#fff3b0" />}
      {type === "day" && <g fill="#fff" opacity={0.85}><ellipse cx={300 + pan} cy={420} rx={150} ry={46} /><ellipse cx={800 - pan} cy={600} rx={180} ry={52} /></g>}
      {(type === "room" || type === "office") && <rect x={640} y={420} width={320} height={420} fill={type === "room" ? "#1d3557" : "#a8dadc"} stroke="#111" strokeWidth={10} />}
      {type === "stage" && <polygon points="540,0 220,1500 860,1500" fill="rgba(255,230,150,0.28)" />}
      {(type === "night" || type === "dusk" || type === "crowd") &&
        Array.from({ length: 12 }, (_, i) => {
          const w = 90 + ((i * 37) % 60);
          const h = 260 + ((i * 71) % 320);
          const x = i * 100 + pan * 0.6 - 20;
          return (
            <g key={i}>
              <rect x={x} y={1500 - h} width={w} height={h} fill="#0b0f1d" />
              {Array.from({ length: 6 }, (_, k) => (
                <rect key={k} x={x + 14 + (k % 2) * 34} y={1500 - h + 30 + Math.floor(k / 2) * 60} width={18} height={26} fill="#ffd166" opacity={(i + k) % 3 === 0 ? 0 : 0.6} />
              ))}
            </g>
          );
        })}
      <rect y={1500} width={1080} height={420} fill={GROUND[type] || "#0d1020"} />
      <rect y={1500} width={1080} height={6} fill="rgba(255,255,255,0.15)" />
    </svg>
  );
};

const Prop: React.FC<{ kind: string; f: number; hx: number; accent: string }> = ({ kind, f, hx, accent }) => {
  const pulse = 1 + Math.sin(f / 6) * 0.08;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute" }}>
      {kind === "think" && (
        <g>
          <circle cx={hx + 110} cy={960} r={10} fill="#fff" />
          <circle cx={hx + 150} cy={905} r={16} fill="#fff" />
          <ellipse cx={hx + 240} cy={800} rx={110} ry={72} fill="#fff" />
          <text x={hx + 240} y={832} fontSize={96} fontWeight={800} textAnchor="middle" fill="#222">?</text>
        </g>
      )}
      {kind === "phone" && (
        <g>
          <rect x={620} y={820} width={300} height={560} rx={44} fill="#111" stroke="#777" strokeWidth={6} />
          <rect x={638} y={850} width={264} height={500} rx={24} fill="#1d2b53" />
          <text x={770} y={1030} fontSize={110} textAnchor="middle" fill="#ff4d6d" transform={`translate(0,0) scale(${pulse})`} style={{ transformOrigin: "770px 1030px" }}>♥</text>
          <rect x={690} y={1230} width={160} height={64} rx={32} fill={accent} opacity={0.6 + Math.abs(Math.sin(f / 8)) * 0.4} />
          <text x={770} y={1274} fontSize={34} fontWeight={800} textAnchor="middle" fill="#111">Post</text>
        </g>
      )}
      {kind === "fork" && (
        <g fill="#8d6e63" stroke="#111" strokeWidth={5}>
          <polygon points="620,1120 820,1120 860,1160 820,1200 620,1200" />
          <polygon points="760,1260 960,1260 1000,1300 960,1340 760,1340" transform="translate(0,0)" />
          <rect x={700} y={1200} width={16} height={300} />
        </g>
      )}
      {kind === "shadow" && (
        <g transform={`translate(770,1150) scale(${1 + Math.sin(f / 10) * 0.06})`}>
          <ellipse cx={0} cy={0} rx={260} ry={320} fill="#000" opacity={0.88} />
          <ellipse cx={-80} cy={-60} rx={34} ry={24} fill="#fff" />
          <ellipse cx={80} cy={-60} rx={34} ry={24} fill="#fff" />
          <path d="M-100 60 Q0 120 100 60" stroke="#fff" strokeWidth={8} fill="none" />
        </g>
      )}
      {kind === "orb" && (
        <g>
          <circle cx={780} cy={1500} r={110 * pulse} fill="#ffd166" opacity={0.25} />
          <circle cx={780} cy={1500} r={70} fill="#ffd166" />
          <rect x={600} y={1500} width={400} height={30} fill="#0d1020" />
        </g>
      )}
      {kind === "crowd" &&
        Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`translate(${460 + i * 100 + f * 0.7},${1230 - i * 6}) scale(0.24)`}>
            <Stick pose="walk" color={i % 2 ? "#ff9f1c" : "#e5e5e5"} f={f + i * 5} />
          </g>
        ))}
      {kind === "bulb" && (
        <g>
          <circle cx={hx + 200} cy={860} r={130 * pulse} fill="#ffd166" opacity={0.25} />
          <circle cx={hx + 200} cy={860} r={80} fill="#ffd166" stroke="#111" strokeWidth={6} />
          <rect x={hx + 170} y={935} width={60} height={40} rx={8} fill="#999" />
        </g>
      )}
      {kind === "laptop" && (
        <g>
          <rect x={640} y={1230} width={320} height={210} rx={14} fill="#1d2b53" stroke="#777" strokeWidth={6} />
          {[0, 1, 2].map((i) => <rect key={i} x={668} y={1262 + i * 44} width={80 + ((f * 3 + i * 40) % 180)} height={20} rx={8} fill={accent} opacity={0.8} />)}
          <rect x={610} y={1440} width={380} height={22} rx={10} fill="#adb5bd" />
        </g>
      )}
      {kind === "trophy" && (
        <g transform="translate(780,1500)">
          <rect x={-22} y={-150} width={44} height={150} fill="#e0a800" stroke="#111" strokeWidth={5} />
          <path d="M-100 -380 H100 Q100 -170 0 -170 Q-100 -170 -100 -380 Z" fill="#ffd166" stroke="#111" strokeWidth={6} />
          <rect x={-80} y={-30} width={160} height={30} rx={8} fill="#8d6e63" stroke="#111" strokeWidth={5} />
        </g>
      )}
      {kind === "money" && [0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx={780} cy={1480 - i * 34} rx={90} ry={26} fill="#ffd166" stroke="#111" strokeWidth={5} />
          {i === 3 && <text x={780} y={1460 - i * 34 + 14} fontSize={36} fontWeight={800} textAnchor="middle" fill="#8d6e63">Rp</text>}
        </g>
      ))}
      {kind === "confetti" &&
        Array.from({ length: 40 }, (_, i) => (
          <rect key={i} x={(i * 79) % 1080} y={((f * (6 + (i % 5)) + i * 90) % 1900) - 50} width={14} height={22} fill={["#ffd166", "#ff6b6b", "#4cc9f0", "#06d6a0"][i % 4]} transform={`rotate(${f * 6 + i * 20} ${(i * 79) % 1080} 0)`} />
        ))}
    </svg>
  );
};

const CardView: React.FC<{ c: Card; f: number; accent: string }> = ({ c, f, accent }) => {
  const { fps } = useVideoConfig();
  const pop = (d: number) => spring({ frame: f - d, fps, config: { damping: 13 } });
  const items = c.items || [];
  const m = (c.value || "").match(/[\d.,]+/);
  const num = m ? parseFloat(m[0].replace(",", ".")) : NaN;
  const shown = m && !isNaN(num) ? (c.value || "").replace(m[0], String(Math.round(num * Math.min(1, f / 40)))) : c.value;
  const box: React.CSSProperties = { fontFamily: "Arial, sans-serif", color: "#fff", textShadow: "0 3px 16px rgba(0,0,0,0.6)" };
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 640, ...box }}>
      {c.title ? <div style={{ fontSize: 54, fontWeight: 800, opacity: pop(2), marginBottom: 30, textAlign: "center", width: 900 }}>{c.title}</div> : null}
      {c.type === "list" && items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, width: 880, margin: "10px 0", opacity: pop(10 + i * 10), transform: `translateX(${(1 - pop(10 + i * 10)) * -140}px)` }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: accent, color: "#111", fontSize: 42, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
          <div style={{ fontSize: 50, fontWeight: 700 }}>{it}</div>
        </div>
      ))}
      {c.type === "stat" && (
        <>
          <div style={{ fontSize: 210, fontWeight: 900, color: accent, transform: `scale(${0.6 + 0.4 * pop(4)})` }}>{shown}</div>
          <div style={{ fontSize: 52, textAlign: "center", width: 840, opacity: pop(14) }}>{c.label}</div>
        </>
      )}
      {c.type === "bars" && items.map((it, i) => {
        const [lb, v] = it.split("|");
        const w = Math.min(100, Math.max(5, parseFloat(v) || 50)) * 6.4 * Math.min(1, pop(8 + i * 8));
        return (
          <div key={i} style={{ width: 880, margin: "12px 0" }}>
            <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 6 }}>{lb}</div>
            <div style={{ height: 48, width: w, borderRadius: 24, background: accent }} />
          </div>
        );
      })}
      {c.type === "tool" && (
        <div style={{ width: 860, padding: 40, borderRadius: 44, background: "rgba(16,20,40,0.92)", border: `4px solid ${accent}`, transform: `scale(${0.8 + 0.2 * pop(2)})`, opacity: pop(2) }}>
          <div style={{ fontSize: 66, fontWeight: 900, color: accent }}>{c.name}</div>
          <div style={{ fontSize: 40, margin: "10px 0 24px", opacity: 0.9 }}>{c.tagline}</div>
          {items.map((it, i) => (
            <div key={i} style={{ fontSize: 40, margin: "10px 0", opacity: pop(12 + i * 8) }}>✓ {it}</div>
          ))}
          <div style={{ marginTop: 28, display: "inline-block", padding: "16px 40px", borderRadius: 40, background: accent, color: "#111", fontSize: 40, fontWeight: 800, opacity: pop(12 + items.length * 8) }}>{c.cta || "Coba sekarang"}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ s: Scn; first: boolean; len: number }> = ({ s, first, len }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = first ? 1 : interpolate(f, [0, XF], [0, 1], clamp);
  const p = f / len;
  const hero = s.chars[0] || { x: 540 };
  return (
    <AbsoluteFill style={{ transform: `translateX(${(1 - t) * 1080}px)` }}>
      <AbsoluteFill style={{ transform: `scale(${1 + p * 0.07})` }}>
        <Bg type={s.bg} f={f} p={p} />
        {s.prop ? <Prop kind={s.prop} f={f} hx={hero.x} accent={s.accent} /> : null}
        {s.card ? <CardView c={s.card} f={f} accent={s.accent} /> : null}
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute" }}>
          {s.chars.map((c, i) => {
            const sc = c.s ?? 1;
            const sp = spring({ frame: f - 4, fps, config: { damping: 14 } });
            const off = c.enter === "left" ? -(c.x + 300) * (1 - sp) : c.enter === "right" ? (1080 - c.x + 300) * (1 - sp) : 0;
            const x = (c.walkTo ? interpolate(f, [0, len], [c.x, c.walkTo], clamp) : c.x) + off;
            return (
              <g key={i} transform={`translate(${x},1500) scale(${c.flip ? -sc : sc},${sc})`}>
                <ellipse cx={0} cy={4} rx={90} ry={14} fill="#000" opacity={0.35} />
                <Stick pose={c.pose} color={c.color ?? "#4cc9f0"} f={f + i * 7} type={c.type} />
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ total: number; scenes: Scn[] }> = ({ total, scenes }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words: { w: string; hl: boolean; a: number; b: number; accent: string }[] = [];
  scenes.forEach((s, si) => {
    const a = Math.round(s.start * FPS);
    const b = si < scenes.length - 1 ? Math.round(scenes[si + 1].start * FPS) : total;
    const toks = s.title.split(/\s+/).filter(Boolean);
    const wt = toks.map((t) => t.replace(/\*/g, "").length + 2);
    const sum = wt.reduce((x, y) => x + y, 0) || 1;
    let acc = a;
    toks.forEach((t, i) => {
      const l = ((b - a) * wt[i]) / sum;
      words.push({ w: t.replace(/\*/g, ""), hl: t.includes("*"), a: acc, b: acc + l, accent: s.accent });
      acc += l;
    });
  });
  const cur = words.find((x) => f >= x.a && f < x.b);
  if (!cur) return null;
  const sp = spring({ frame: f - cur.a, fps, config: { damping: 12, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 430 }}>
      <span
        style={{
          fontFamily: "Arial, sans-serif",
          fontWeight: 800,
          fontSize: cur.hl ? 92 : 68,
          color: cur.hl ? cur.accent : "white",
          transform: `scale(${interpolate(sp, [0, 1], [0.7, 1])})`,
          opacity: Math.min(1, sp * 2),
          textShadow: "0 4px 22px rgba(0,0,0,0.9)",
        }}
      >
        {cur.w}
      </span>
    </AbsoluteFill>
  );
};

export const VectorStory: React.FC<StoryProps> = ({ name, data }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!data) return null;
  const { scenes, watermark, music } = data;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio src={staticFile(name + "/voiceover.mp3")} />
      {music ? <Audio src={staticFile(name + "/music.mp3")} volume={0.12} loop /> : null}
      {scenes.map((s, i) => {
        const a = Math.round(s.start * FPS);
        const b = i < scenes.length - 1 ? Math.round(scenes[i + 1].start * FPS) : durationInFrames;
        const pad = i === 0 ? 0 : XF;
        return (
          <Sequence key={i} from={Math.max(0, a - pad)} durationInFrames={Math.max(b - a + pad, 1)}>
            <SceneView s={s} first={i === 0} len={Math.max(b - a + pad, 1)} />
          </Sequence>
        );
      })}
      <Captions total={durationInFrames} scenes={scenes} />
      {watermark ? <div style={{ position: "absolute", left: 60, bottom: 330, color: "rgba(255,255,255,0.45)", fontSize: 34, fontFamily: "Arial, sans-serif" }}>{watermark}</div> : null}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, backgroundColor: "rgba(255,255,255,0.8)" }} />
    </AbsoluteFill>
  );
};
