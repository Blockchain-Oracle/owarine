import type { Metadata } from "next";
import { WHO_SEES_WHAT } from "@/features/privacy-matrix/copy";
import { WhoSeesWhatPage } from "@/features/privacy-matrix/WhoSeesWhatPage";

export const metadata: Metadata = { title: WHO_SEES_WHAT.title, description: WHO_SEES_WHAT.meta };

/** `/who-sees-what` (C-ADD-11): the privacy matrix with the commands that prove it. Static. */
export default function Page() {
  return <WhoSeesWhatPage />;
}
