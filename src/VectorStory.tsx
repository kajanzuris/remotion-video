import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FPS = 30;
const XF = 10; // frame overlap transisi antar adegan
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Pose = "idle" | "point" | "shock" | "sad" | "cheer" | "wave" | "walk" | "tremble" | "think";
type Card = { type: "list" | "stat" | "bars" | "tool"; title?: string; items?: string[]; value?: string; label?: string; name?: string; tagline?: string; cta?: string };
type Char = { type?: string; x: number; pose: Pose; enter?: "left" | "right"; s?: number; color?: string; flip?: boolean; walkTo?: number; img?: string; talkImg?: string };
type Scn = { title: string; start: number; accent: string; bg: string; chars: Char[]; prop?: string; card?: Card };
// waktu kata (detik) hasil tools/prepare.py; s = indeks adegan
type Word = { w: string; hl: boolean; a: number; b: number; s: number };

export type VideoData = { durationInFrames: number; watermark?: string; music?: boolean; cta?: string; words?: Word[]; env?: number[]; style?: "stick" | "robot" | "block" | "sprite"; scenes: Scn[] };
export type StoryProps = { name: string; data?: VideoData };

// Kartu lama menyimpan semua isi di satu string `value` → ubah ke field terstruktur (aman untuk data lama maupun baru)
const normCard = (c: Card): Card => {
  if (c.items || c.label || !c.value) return c;
  if (c.type === "list") {
    const title = c.value.match(/title:\s*([^,]+)/i)?.[1]?.trim();
    const items = c.value.match(/items:\s*\[(.*)\]/i)?.[1]?.split(",").map((x) => x.trim());
    return { ...c, title: c.title ?? title, items };
  }
  if (c.type === "stat" && c.value.includes("|")) {
    const [v, l] = c.value.split("|");
    return { ...c, value: v, label: l };
  }
  return c;
};

const Limb: React.FC<{ x1: number; y1: number; x2: number; y2: number; c: string }> = ({ x1, y1, x2, y2, c }) => (
  <g strokeLinecap="round">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111" strokeWidth={32} />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={22} />
  </g>
);

// talk (0..1) = kerasnya suara pada frame ini → mulut ikut membuka (lip-sync sederhana)
const Stick: React.FC<{ pose: Pose; color: string; f: number; type?: string; talk?: number }> = ({ pose, color, f, type, talk }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const talking = talk !== undefined && talk > 0.07;
  const breathe = Math.sin(f / 9) * 3 - (talking ? (talk as number) * 3 : 0);
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
  if (talk !== undefined) mouth = talking ? "talk" : pose === "sad" || pose === "think" ? "sad" : "smile";
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
        {mouth === "talk" && <ellipse cx={0} cy={-382 + breathe} rx={13 + (talk as number) * 9} ry={4 + (talk as number) * 24} fill="#111" />}
        {mouth === "o" && <circle cx={0} cy={-380 + breathe} r={13} fill="#111" />}
        {pose === "sad" && <circle cx={30} cy={-405 + breathe + (f % 40)} r={6} fill="#6ec6ff" opacity={1 - (f % 40) / 40} />}
      </g>
    </g>
  );
};

// Karakter BLOK (gaya game, ORISINAL): kepala & badan kotak, lengan/kaki balok. Pose dan lip-sync sama dengan Stick.
const Block: React.FC<{ pose: Pose; color: string; f: number; type?: string; talk?: number }> = ({ pose, color, f, type, talk }) => {
  const talking = talk !== undefined && talk > 0.07;
  const breathe = Math.sin(f / 9) * 3 - (talking ? (talk as number) * 3 : 0);
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
  if (talk !== undefined) mouth = talking ? "talk" : pose === "sad" || pose === "think" ? "sad" : "smile";
  const shake = pose === "tremble" ? Math.sin(f * 2.2) * 5 : 0;
  const bob = pose === "walk" ? Math.abs(Math.sin(f / 4)) * -10 : 0;
  const SK = type === "robot" ? "#cfd8dc" : "#f2c9a0", ln = "#111", b = breathe;
  const arm = (side: number, a: number) => (
    <g transform={`translate(${side * 76},${-322 + b}) rotate(${a})`}>
      <rect x={-17} y={-6} width={34} height={140} rx={8} fill={SK} stroke={ln} strokeWidth={5} />
      <rect x={-17} y={-6} width={34} height={64} rx={8} fill={color} stroke={ln} strokeWidth={5} />
    </g>
  );
  const leg = (side: number) => (
    <g transform={`translate(${side * 30},-190) rotate(${side * legs * 0.3})`}>
      <rect x={-22} y={0} width={44} height={190} rx={6} fill="#2b2d42" stroke={ln} strokeWidth={5} />
    </g>
  );
  return (
    <g transform={`translate(${shake},${bob})`}>
      {leg(-1)}
      {leg(1)}
      <rect x={-62} y={-335 + b} width={124} height={150} rx={10} fill={color} stroke={ln} strokeWidth={6} />
      {type === "girl" && <rect x={-80} y={-215 + b} width={160} height={58} rx={10} fill={color} stroke={ln} strokeWidth={6} />}
      {arm(-1, aL)}
      {arm(1, aR)}
      <g transform={`rotate(${tilt} 0 -345)`}>
        <rect x={-64} y={-482 + b} width={128} height={128} rx={14} fill={SK} stroke={ln} strokeWidth={6} />
        {type === "girl" && <g fill="#3a1f0d" stroke={ln} strokeWidth={5}><rect x={-70} y={-494 + b} width={140} height={44} rx={10} /><rect x={-70} y={-494 + b} width={26} height={118} rx={8} /><rect x={44} y={-494 + b} width={26} height={118} rx={8} /></g>}
        {type === "boss" && <g fill="#222"><rect x={-84} y={-498 + b} width={168} height={24} rx={8} /><rect x={-52} y={-544 + b} width={104} height={50} rx={8} /></g>}
        {type === "robot" && <g><rect x={-54} y={-440 + b} width={108} height={36} rx={8} fill="#1d2b53" /><line x1={0} y1={-482 + b} x2={0} y2={-522 + b} stroke={ln} strokeWidth={6} /><circle cx={0} cy={-530 + b} r={9} fill="#ff6b6b" /></g>}
        {blink ? (
          <g stroke={ln} strokeWidth={5}><line x1={-36} y1={-424 + b} x2={-16} y2={-424 + b} /><line x1={16} y1={-424 + b} x2={36} y2={-424 + b} /></g>
        ) : (
          <g fill={type === "robot" ? "#7df9ff" : "#111"}><rect x={-36} y={-434 + b} width={18} height={20} /><rect x={18} y={-434 + b} width={18} height={20} /></g>
        )}
        {mouth === "smile" && <path d={`M-24 ${-390 + b} Q0 ${-366 + b} 24 ${-390 + b}`} stroke={ln} strokeWidth={5} fill="none" />}
        {mouth === "sad" && <path d={`M-22 ${-372 + b} Q0 ${-394 + b} 22 ${-372 + b}`} stroke={ln} strokeWidth={5} fill="none" />}
        {mouth === "open" && <rect x={-15} y={-396 + b} width={30} height={14 + Math.abs(Math.sin(f / 3)) * 10} rx={4} fill={ln} />}
        {mouth === "talk" && <rect x={-14 - (talk as number) * 6} y={-396 + b} width={28 + (talk as number) * 12} height={4 + (talk as number) * 24} rx={4} fill={ln} />}
        {mouth === "o" && <rect x={-12} y={-394 + b} width={24} height={24} rx={4} fill={ln} />}
      </g>
    </g>
  );
};

// Gerak untuk karakter SPRITE (gambar PNG transparan): napas, goyang, memantul sesuai pose, membesar-mengecil saat bicara.
const spriteMotion = (pose: Pose, f: number, talk: number) => {
  let dx = 0, dy = 0, rot = Math.sin(f / 25) * 1.2;
  let sx = 1 - 0.012 * talk, sy = 1 + 0.015 * Math.sin(f / 9) + 0.03 * talk;
  if (pose === "cheer") { dy = -Math.abs(Math.sin(f / 5)) * 34; rot += Math.sin(f / 5) * 3; }
  else if (pose === "walk") { dy = -Math.abs(Math.sin(f / 4)) * 16; rot += Math.sin(f / 4) * 3; }
  else if (pose === "tremble") dx = Math.sin(f * 2.2) * 6;
  else if (pose === "sad") { rot += 5; dy = 10; }
  else if (pose === "think") rot -= 4;
  else if (pose === "shock") { sx *= 1.05; sy *= 1.05; dy = -8; }
  else if (pose === "wave" || pose === "point") rot += Math.sin(f / 8) * 2;
  return { dx, dy, rot, sx, sy };
};
const isImg = (b: string) => /[./]/.test(b);   // bg berupa file gambar (mis. "img/bg1.png") bukan nama latar vektor

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

// Kartu info di atas panel gelap supaya terbaca di latar terang maupun gelap
const CardView: React.FC<{ c: Card; f: number; accent: string }> = ({ c: raw, f, accent }) => {
  const { fps } = useVideoConfig();
  const c = normCard(raw);
  const pop = (d: number) => spring({ frame: f - d, fps, config: { damping: 13 } });
  const items = c.items || [];
  const m = (c.value || "").match(/[\d.,]+/);
  const num = m ? parseFloat(m[0].replace(",", ".")) : NaN;
  const shown = m && !isNaN(num) ? (c.value || "").replace(m[0], String(Math.round(num * Math.min(1, f / 40)))) : c.value;
  const box: React.CSSProperties = { fontFamily: "Arial, sans-serif", color: "#fff" };
  const panel: React.CSSProperties = { width: 920, padding: "44px 40px", borderRadius: 48, background: "rgba(14,18,38,0.86)", border: `5px solid ${accent}`, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${0.85 + 0.15 * Math.min(1, pop(0))})`, opacity: Math.min(1, pop(0) * 2) };
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 700, ...box }}>
      {c.type !== "tool" && (
        <div style={panel}>
          {c.title ? <div style={{ fontSize: 58, fontWeight: 900, color: accent, opacity: pop(2), marginBottom: 26, textAlign: "center" }}>{c.title}</div> : null}
          {c.type === "list" && items.map((it, i) => {
            const k = Math.min(1, pop(10 + i * 10));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, width: 820, margin: "12px 0", opacity: k, transform: `translateX(${(1 - k) * -140}px)` }}>
                <div style={{ width: 72, height: 72, borderRadius: 36, background: accent, color: "#111", fontSize: 42, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 52, fontWeight: 700 }}>{it}</div>
              </div>
            );
          })}
          {c.type === "stat" && (
            <>
              <div style={{ fontSize: 200, fontWeight: 900, color: accent, transform: `scale(${0.6 + 0.4 * Math.min(1.1, pop(4))})` }}>{shown}</div>
              <div style={{ fontSize: 56, fontWeight: 700, textAlign: "center", width: 800, opacity: pop(14) }}>{c.label}</div>
            </>
          )}
          {c.type === "bars" && items.map((it, i) => {
            const [lb, v] = it.split("|");
            const w = Math.min(100, Math.max(5, parseFloat(v) || 50)) * 7.6 * Math.min(1, pop(8 + i * 8));
            return (
              <div key={i} style={{ width: 820, margin: "12px 0" }}>
                <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 6 }}>{lb}</div>
                <div style={{ height: 48, width: w, borderRadius: 24, background: accent }} />
              </div>
            );
          })}
        </div>
      )}
      {c.type === "tool" && (
        <div style={{ width: 860, padding: 40, borderRadius: 44, background: "rgba(16,20,40,0.92)", border: `4px solid ${accent}`, transform: `scale(${0.8 + 0.2 * Math.min(1, pop(2))})`, opacity: Math.min(1, pop(2)) }}>
          <div style={{ fontSize: 66, fontWeight: 900, color: accent }}>{c.name}</div>
          <div style={{ fontSize: 40, margin: "10px 0 24px", opacity: 0.9 }}>{c.tagline}</div>
          {items.map((it, i) => (
            <div key={i} style={{ fontSize: 40, margin: "10px 0", opacity: Math.min(1, pop(12 + i * 8)) }}>✓ {it}</div>
          ))}
          <div style={{ marginTop: 28, display: "inline-block", padding: "16px 40px", borderRadius: 40, background: accent, color: "#111", fontSize: 40, fontWeight: 800, opacity: Math.min(1, pop(12 + items.length * 8)) }}>{c.cta || "Coba sekarang"}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// Kamera berbeda tiap adegan: push-in, close-up ke karakter, pan, pull-out, tilt
const CAMS = [
  { s: [1.0, 1.1], x: [0, -20], y: [0, 0], close: false },
  { s: [1.0, 1.4], x: [0, 0], y: [0, 0], close: true },
  { s: [1.12, 1.12], x: [50, -50], y: [0, 0], close: false },
  { s: [1.35, 1.0], x: [0, 0], y: [0, 0], close: true },
  { s: [1.12, 1.12], x: [-50, 50], y: [0, 0], close: false },
  { s: [1.0, 1.12], x: [0, 0], y: [40, -30], close: false },
];

const SceneView: React.FC<{ s: Scn; idx: number; first: boolean; len: number; from: number; env?: number[]; name: string; style: string }> = ({ s, idx, first, len, from, env, name, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const te = first ? 1 : Easing.out(Easing.cubic)(interpolate(f, [0, XF], [0, 1], clamp));
  const p = Easing.inOut(Easing.cubic)(interpolate(f, [0, len], [0, 1], clamp));
  const hero = s.chars[0] || { x: 540 };
  const cam = s.chars.length ? CAMS[idx % CAMS.length] : CAMS[0];
  const lerp = (a: number[]) => a[0] + (a[1] - a[0]) * p;
  const impact = s.card?.type === "stat" || s.prop === "confetti" || s.prop === "bulb";
  const sf = f - XF;
  const sh = impact && sf >= 0 && sf < 12 ? Math.sin(sf * 2.6) * ((12 - sf) / 12) * 14 : 0;
  const kind = first ? -1 : idx % 4;
  const outer: React.CSSProperties =
    kind === 0 ? { transform: `translateX(${(1 - te) * 1080}px)` }
    : kind === 1 ? { transform: `translateX(${-(1 - te) * 1080}px)` }
    : kind === 2 ? { transform: `translateY(${(1 - te) * 1920}px)` }
    : kind === 3 ? { clipPath: `circle(${te * 150}% at 50% 62%)` }
    : {};
  const talk = env ? env[Math.min(env.length - 1, from + f)] : undefined;
  const sp0 = spring({ frame: f - 4, fps, config: { damping: 14 } });
  const place = (c: Char) => {
    const sc = c.s ?? 1;
    const off = c.enter === "left" ? -(c.x + 300) * (1 - sp0) : c.enter === "right" ? (1080 - c.x + 300) * (1 - sp0) : 0;
    const x = (c.walkTo ? interpolate(f, [0, len], [c.x, c.walkTo], clamp) : c.x) + off;
    return { x, sc };
  };
  return (
    <AbsoluteFill style={outer}>
      <AbsoluteFill style={{ transformOrigin: cam.close ? `${hero.x}px 1050px` : "50% 55%", transform: `translate(${lerp(cam.x) + sh}px, ${lerp(cam.y) + sh * 0.6}px) scale(${lerp(cam.s)})` }}>
        {isImg(s.bg) ? (
          <AbsoluteFill style={{ overflow: "hidden" }}>
            <Img src={staticFile(`${name}/${s.bg}`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(1.08) translateX(${-p * 30}px)` }} />
          </AbsoluteFill>
        ) : (
          <Bg type={s.bg} f={f} p={p} />
        )}
        {s.chars.length > 0 && !isImg(s.bg) && (
          <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute" }}>
            <circle cx={hero.x} cy={1130} r={340} fill={s.accent} opacity={0.16} />
          </svg>
        )}
        {s.prop ? <Prop kind={s.prop} f={f} hx={hero.x} accent={s.accent} /> : null}
        {s.card ? <CardView c={s.card} f={f} accent={s.accent} /> : null}
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute" }}>
          {s.chars.map((c, i) => {
            const { x, sc } = place(c);
            const col = c.color ?? "#4cc9f0";
            const tk = i === 0 ? talk : undefined;
            return (
              <g key={i} transform={`translate(${x},1500) scale(${c.flip ? -sc : sc},${sc})`}>
                <ellipse cx={0} cy={4} rx={90} ry={14} fill="#000" opacity={0.35} />
                {c.img ? null : style === "block" || c.type === "block" ? (
                  <Block pose={c.pose} color={col} f={f + i * 7} type={c.type} talk={tk} />
                ) : (
                  <Stick pose={c.pose} color={col} f={f + i * 7} type={style === "robot" ? "robot" : c.type} talk={tk} />
                )}
              </g>
            );
          })}
        </svg>
        {s.chars.map((c, i) => {
          if (!c.img) return null;
          const { x, sc } = place(c);
          const t = i === 0 ? talk ?? 0 : 0;
          const m = spriteMotion(c.pose, f + i * 7, t);
          const enterDy = (1 - Math.min(1, sp0)) * 80;
          return (
            <div key={"sp" + i} style={{ position: "absolute", left: x, top: 1500, height: 760 * sc, display: "grid", transformOrigin: "50% 100%", transform: `translate(-50%, -100%) translate(${m.dx}px, ${m.dy + enterDy}px) rotate(${m.rot}deg) scale(${(c.flip ? -1 : 1) * m.sx}, ${m.sy})` }}>
              <Img src={staticFile(`${name}/${c.img}`)} style={{ gridArea: "1 / 1", height: "100%", width: "auto" }} />
              {c.talkImg ? <Img src={staticFile(`${name}/${c.talkImg}`)} style={{ gridArea: "1 / 1", height: "100%", width: "auto", opacity: t > 0.25 ? 1 : 0 }} /> : null}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Caption: grup 3–4 kata di atas panel gelap; kata yang sedang diucapkan menyala dan memantul, kata penting (*...*) berwarna aksen.
const groupsOf = (words: Word[]) => {
  const g: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w) => {
    if (cur.length && (cur.length >= 4 || cur[0].s !== w.s)) { g.push(cur); cur = []; }
    cur.push(w);
    if (/[.?!,]$/.test(w.w)) { g.push(cur); cur = []; }
  });
  if (cur.length) g.push(cur);
  return g;
};

const Captions: React.FC<{ words: Word[]; accents: string[] }> = ({ words, accents }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const groups = useMemo(() => groupsOf(words), [words]);
  const t = f / FPS;
  let gi = -1;
  for (let i = 0; i < groups.length; i++) if (t >= groups[i][0].a - 0.05) gi = i;
  if (gi < 0) gi = 0;
  const g = groups[gi];
  if (!g || t > g[g.length - 1].b + 0.6) return null;
  const sp = spring({ frame: f - Math.round(g[0].a * FPS), fps, config: { damping: 13, stiffness: 190 } });
  const accent = accents[g[0].s] || "#FFD166";
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 300 }}>
      <div style={{ width: 940, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 22px", padding: "26px 36px", borderRadius: 48, background: "rgba(10,12,24,0.62)", transform: `scale(${0.88 + 0.12 * Math.min(1, sp)})`, opacity: 0.35 + 0.65 * Math.min(1, sp) }}>
        {g.map((w, i) => {
          const active = t >= w.a && t < w.b;
          const spoken = t >= w.b;
          const k = spring({ frame: f - Math.round(w.a * FPS), fps, config: { damping: 9, stiffness: 240 } });
          return (
            <span key={i} style={{ display: "inline-block", fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: w.hl ? 90 : 74, lineHeight: 1.25, color: w.hl ? accent : "#fff", opacity: spoken || active ? 1 : 0.55, transform: `scale(${active ? 1 + 0.14 * Math.min(1.2, k) : 1})`, textShadow: "0 4px 18px rgba(0,0,0,0.7)" }}>
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const VectorStory: React.FC<StoryProps> = ({ name, data }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  if (!data) return null;
  const { scenes, watermark, cta, words, env } = data;
  const style = data.style ?? "stick";
  const ctaStart = durationInFrames - Math.round(2.0 * FPS);
  const cp = spring({ frame: frame - ctaStart, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* mix.wav = suara + musik (di-duck) + SFX, dibuat oleh tools/prepare.py */}
      <Audio src={staticFile(name + "/mix.wav")} />
      {scenes.map((s, i) => {
        const a = Math.round(s.start * FPS);
        const b = i < scenes.length - 1 ? Math.round(scenes[i + 1].start * FPS) : durationInFrames;
        const pad = i === 0 ? 0 : XF;
        const from = Math.max(0, a - pad);
        return (
          <Sequence key={i} from={from} durationInFrames={Math.max(b - a + pad, 1)}>
            <SceneView s={s} idx={i} first={i === 0} len={Math.max(b - a + pad, 1)} from={from} env={env} name={name} style={style} />
          </Sequence>
        );
      })}
      {words && words.length ? <Captions words={words} accents={scenes.map((s) => s.accent)} /> : null}
      {cta && frame >= ctaStart ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 300 }}>
          <div style={{ padding: "26px 56px", borderRadius: 60, background: scenes[scenes.length - 1].accent, color: "#111", fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 54, textAlign: "center", transform: `scale(${0.7 + 0.3 * Math.min(1.1, cp)})`, opacity: Math.min(1, cp * 2) }}>{cta}</div>
        </AbsoluteFill>
      ) : null}
      {watermark ? <div style={{ position: "absolute", left: 60, bottom: 330, color: "rgba(255,255,255,0.45)", fontSize: 34, fontFamily: "Arial, sans-serif" }}>{watermark}</div> : null}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, backgroundColor: "rgba(255,255,255,0.8)" }} />
    </AbsoluteFill>
  );
};
