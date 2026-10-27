import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { StoryProps, VectorStory, VideoData } from "./VectorStory";

const calc: CalculateMetadataFunction<StoryProps> = async ({ props }) => {
  const res = await fetch(staticFile(`${props.name}/scenes.json`));
  if (!res.ok) throw new Error(`public/${props.name}/scenes.json tidak ditemukan (jalankan: python3 tools/prepare.py ${props.name})`);
  const data = (await res.json()) as VideoData;
  // env.json (kerasnya suara per frame, dibuat tools/prepare.py) untuk lip-sync; opsional
  try {
    const r = await fetch(staticFile(`${props.name}/env.json`));
    if (r.ok) data.env = (await r.json()) as number[];
  } catch (e) {
    /* tanpa lip-sync */
  }
  return {
    durationInFrames: Math.max(1, Math.round(data.durationInFrames)),
    props: { ...props, data },
  };
};

// Cukup dipasang SEKALI. Video baru = folder baru di public/<nama>/, tanpa mengubah file ini.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Cerita"
      component={VectorStory}
      durationInFrames={30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ name: "video1" } as StoryProps}
      calculateMetadata={calc}
    />
  );
};
