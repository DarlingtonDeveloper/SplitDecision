import { Composition } from "remotion";
import { SplitDecisionDemo } from "./Demo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SplitDecisionDemo"
      component={SplitDecisionDemo}
      durationInFrames={60 * 30} // 2 minutes at 30fps
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
