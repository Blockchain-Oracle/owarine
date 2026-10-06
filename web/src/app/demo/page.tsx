import type { Metadata } from "next";
import { connection } from "next/server";
import { DEMO, DemoPage } from "@/features/demo";
import { readPublicRelease } from "@/lib/release";

/** Images come from the site's file-based OG route (15a); a route-level image would outrank it with nothing better. */
export const metadata: Metadata = {
  title: DEMO.title,
  description: DEMO.video.description,
  alternates: { canonical: "/demo" },
  openGraph: {
    title: DEMO.video.title,
    description: DEMO.video.description,
    url: "/demo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEMO.video.title,
    description: DEMO.video.description,
  },
};

/** The film is read from the environment per request (`web/src/lib/release.ts`), so setting it needs no rebuild. */
export default async function Page() {
  await connection();
  return <DemoPage film={readPublicRelease().demoFilm} />;
}
