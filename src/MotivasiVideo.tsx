import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Ubah teks di sini. Total frame harus 900 (30 detik x 30 fps).
const scenes = [
  { title: "Takut mulai jualan di sosial media?", sub: "", frames: 90, bg: ["#0f2027", "#2c5364"] },
  { title: "Semua pebisnis besar", sub: "pernah mulai dari nol.", frames: 120, bg: ["#41295a", "#2f0743"] },
  { title: "Kamu tidak harus sempurna.", sub: "Yang penting mulai.", frames: 120, bg: ["#134e5e", "#71b280"] },
  { title: "1. Mulai dari satu produk", sub: "Fokus dulu, jangan semuanya.", frames: 130, bg: ["#232526", "#414345"] },
  { title: "2. Posting tiap hari", sub: "Sederhana pun tidak apa-apa.", frames: 130, bg: ["#1d2b64", "#f8cdda"] },
  { title: "3. Belajar dari respon", sub: "Bukan dari rasa takut.", frames: 150, bg: ["#ff512f", "#dd2476"] },
  { title: "Mulai hari ini.", sub: "Satu posting dulu.", frames: 160, bg: ["#f7971e", "#ffd200"] },
];

const Scene: React.FC<{ title: string; sub: string; frames: number; bg: string[] }> = ({
  title,
  sub,
  frames,
  bg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14 } });
  const y = interpolate(enter, [0, 1], [80, 0]);
  const fadeOut = interpolate(frame, [frames - 15, frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${bg[0]}, ${bg[1]})`,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        opacity: fadeOut,
      }}
    >
      <h1
        style={{
          color: "white",
          fontSize: 92,
          fontFamily: "sans-serif",
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.2,
          margin: 0,
          opacity: enter,
          transform: `translateY(${y}px)`,
        }}
      >
        {title}
      </h1>
      {sub ? (
        <p
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 56,
            fontFamily: "sans-serif",
            textAlign: "center",
            marginTop: 40,
            opacity: subOpacity,
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
      {scenes.map((s, i) => {
        const from = start;
        start += s.frames;
        return (
          <Sequence key={i} from={from} durationInFrames={s.frames}>
            <Scene {...s} />
          </Sequence>
        );
      })}
      {/* Progress bar di bawah */}
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
