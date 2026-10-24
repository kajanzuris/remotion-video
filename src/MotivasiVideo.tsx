import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type SceneData = {
  title: string; // tandai kata penting dengan *bintang*, contoh: *jualan*
  sub?: string;
  frames: number;
  accent: string;
};

// Total frames harus 900 (30 detik x 30 fps)
const scenes: SceneData[] = [
  { title: "Takut mulai *jualan* di sosial media?", frames: 100, accent: "#ffd166" },
  { title: "Semua pebisnis besar pernah mulai dari *nol*.", frames: 120, accent: "#06d6a0" },
  {
    title: "Kamu tidak harus *sempurna*.",
    sub: "Yang penting mulai.",
    frames: 120,
    accent: "#ff9f1c",
  },
  {
    title: "1. Mulai dari *satu* produk",
    sub: "Fokus dulu, jangan semuanya.",
    frames: 130,
    accent: "#4cc9f0",
  },
  {
    title: "2. Posting *tiap hari*",
    sub: "Sederhana pun tidak apa-apa.",
    frames: 130,
    accent: "#f72585",
  },
  {
    title: "3. Belajar dari *respon*",
    sub: "Bukan dari rasa takut.",
    frames: 150,
    accent: "#b5179e",
  },
  { title: "*Mulai* hari ini.", sub: "Satu posting dulu.", frames: 150, accent: "#ffd166" },
];

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const hue = (220 + frame * 0.3) % 360;
  const angle = 160 + frame * 0.15;

  const circles = [
    { size: 700, x: 200, y: 400, speed: 0.012, phase: 0 },
    { size: 600, x: 800, y: 1100, speed: 0.016, phase: 2 },
    { size: 500, x: 300, y: 1600, speed: 0.01, phase: 4 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, hsl(${hue} 60% 14%), hsl(${(hue + 60) % 360} 70% 30%))`,
        overflow: "hidden",
      }}
    >
      {circles.map((c, i) => {
        const dx = Math.sin(frame * c.speed + c.phase) * 120;
        const dy = Math.cos(frame * c.speed + c.phase) * 160;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x + dx - c.size / 2,
              top: c.y + dy - c.size / 2,
              width: c.size,
              height: c.size,
              borderRadius: "50%",
              background: `hsl(${(hue + i * 50) % 360} 80% 60%)`,
              opacity: 0.25,
              filter: "blur(90px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Words: React.FC<{ text: string; accent: string; size: number }> = ({
  text,
  accent,
  size,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tokens = text.split(" ").map((w) => ({
    word: w.replace(/\*/g, ""),
    highlight: w.includes("*"),
  }));

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 28px",
      }}
    >
      {tokens.map((t, i) => {
        const s = spring({
          frame: frame - i * 5,
          fps,
          config: { damping: 14, stiffness: 120 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontSize: size,
              fontWeight: 800,
              fontFamily: "Arial, sans-serif",
              lineHeight: 1.25,
              color: t.highlight ? accent : "white",
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(
                s,
                [0, 1],
                [0.85, 1]
              )})`,
              textShadow: "0 6px 30px rgba(0,0,0,0.35)",
            }}
          >
            {t.word}
          </span>
        );
      })}
    </div>
  );
};

const Scene: React.FC<SceneData> = ({ title, sub, frames, accent }) => {
  const frame = useCurrentFrame();
  const wordCount = title.split(" ").length;

  const exit = interpolate(frame, [frames - 14, frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subStart = wordCount * 5 + 10;
  const subOpacity = interpolate(frame, [subStart, subStart + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [subStart, subStart + 20], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineWidth = interpolate(frame, [0, 25], [0, 220], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
        opacity: 1 - exit,
        transform: `translateY(${-exit * 70}px)`,
      }}
    >
      <div
        style={{
          width: lineWidth,
          height: 10,
          borderRadius: 5,
          backgroundColor: accent,
          marginBottom: 50,
        }}
      />
      <Words text={title} accent={accent} size={96} />
      {sub ? (
        <p
          style={{
            color: "rgba(255,255,255,0.9)",
            fontSize: 56,
            fontFamily: "Arial, sans-serif",
            textAlign: "center",
            marginTop: 50,
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
          }}
        >
          {sub}
        </p>
      ) : null}
    </AbsoluteFill>
  );
};

export const MotivasiVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  let start = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Background />
      {scenes.map((s, i) => {
        const from = start;
        start += s.frames;
        return (
          <Sequence key={i} from={from} durationInFrames={s.frames}>
            <Scene {...s} />
          </Sequence>
        );
      })}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 14,
          width: `${(frame / durationInFrames) * 100}%`,
          backgroundColor: "rgba(255,255,255,0.9)",
        }}
      />
    </AbsoluteFill>
  );
};
