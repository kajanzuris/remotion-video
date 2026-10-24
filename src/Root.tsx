import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { StoryProps, VectorStory, VideoData } from "./VectorStory";

const calc: CalculateMetadataFunction<StoryProps> = async ({ props }) => {
  const res = await fetch(staticFile(`${props.name}/scenes.json`));
  if (!res.ok) throw new Error(`public/${props.name}/scenes.json tidak ditemukan`);
  const data = (await res.json()) as VideoData;
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
