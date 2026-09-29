import { Redirect } from "expo-router";
import { ONBOARDED_KEY } from "~/lib/keys";
import { storage } from "~/lib/storage";

/**
 * First launch opens the app's own onboarding (brand intro, three pages, the demo-credits gate); every launch after
 * lands on /markets. The flag is local to this installation.
 */
export default function Index() {
  return <Redirect href={storage.getBoolean(ONBOARDED_KEY) ? "/markets" : "/onboarding"} />;
}
