import type { Metadata } from "next";
import { connection } from "next/server";
import { DownloadPage, INSTALL } from "@/features/install";
import { readPublicRelease } from "@/lib/release";

export const metadata: Metadata = { title: INSTALL.title };

/**
 * The TestFlight link, the APK and the film are read from the environment per request (`web/src/lib/release.ts`), so a
 * deployment flips each card from its waiting state by setting a value and restarting, with no code change.
 */
export default async function Page() {
  await connection();
  return <DownloadPage release={readPublicRelease()} />;
}
