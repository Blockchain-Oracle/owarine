import { Seal } from "~/components/kit/ow/Seal";
import { useTheme } from "~/theme";

/**
 * Owarine's mark: the 終値 seal (8 Oct). This used to draw Agari's "Window Cut" paths, carried over by the rename; every
 * screen that shows the brand (the brand intro, take a seat, the chrome, Sensei, the claim ticket) now shows the seal.
 * A `figure` equal to the theme's white keeps the white seal (on a dark or pink ground); otherwise the seal is pink.
 */
export function OwarineMark({ width = 18, height, figure }: { width?: number; height?: number; figure?: string }) {
  const { color } = useTheme();
  return <Seal size={Math.max(width, height ?? width)} tone={figure !== undefined && figure === color.ow.white ? "white" : "pink"} rotate={0} />;
}
