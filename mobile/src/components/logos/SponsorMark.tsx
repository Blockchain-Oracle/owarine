import { Image } from "expo-image";
import { useTheme } from "~/theme";
import { SPONSOR_LOGOS, type SponsorLogo } from "./brand-logos";

/**
 * web `components/brand/SponsorMark`: a platform's own mark (K-250) at `height`, its width from the supplied file's
 * aspect, in the variant its brand kit names for the current ground. Announced once, by the brand's name.
 */
export function SponsorMark({ brand, name, aspect, height }: { brand: SponsorLogo; name: string; aspect: number; height: number }) {
  const { name: theme } = useTheme();
  return (
    <Image
      source={SPONSOR_LOGOS[brand][theme]}
      style={{ height, width: Math.round(height * aspect) }}
      contentFit="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
    />
  );
}
