import type { Metadata } from "next";
import { connection } from "next/server";
import { DEMO, DemoPage } from "@/features/demo";
import { readPublicRelease } from "@/lib/release";

export const metadata: Metadata = {
  title: DEMO.title,
  description: DEMO.description,
  alternates: { canonical: "/demo" },
  openGraph: { title: `Owarine · ${DEMO.title}`, description: DEMO.description, url: "/demo", type: "website" },
  twitter: { card: "summary_large_image", title: `Owarine · ${DEMO.title}`, description: DEMO.description },
};

/** The film is read from the environment per request (`web/src/lib/release.ts`), so setting it needs no rebuild. */
export default async function Page() {
  await connection();
  return <DemoPage film={readPublicRelease().demoFilm} />;
}
