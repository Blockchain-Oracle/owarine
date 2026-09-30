import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/states";
import { APP_LINK_SCHEME } from "@/features/canton-ux/seat/link";
import { readXConfig } from "@/features/x/config.server";
import { NATIVE_AUTH } from "@/features/x/copy";
import { nativeHandoffStep, NATIVE_STATE_PARAM } from "@/features/x/native-handoff";
import { X_REASON_PARAM, X_RETURN_PARAM } from "@/features/x/protocol";
import { readSession, X_SESSION_COOKIE } from "@/features/x/session.server";

export const metadata: Metadata = { title: NATIVE_AUTH.title };
export const dynamic = "force-dynamic";

/**
 * `/native-auth` — the X sign-in handoff into the app (plan "Social, X and share": the blocked plate gets a job; C13a,
 * K-145). The app opens `/native-auth?state=<nonce>` in an auth session. Not signed in, this runs the ordinary X sign-in
 * and comes back here; signed in, it hands the signed X session to the app on its own scheme (`APP_LINK_SCHEME`, the
 * web's copy of the app identity's scheme, kept equal by the `mobile-identity` invariant): `<scheme>://x-auth?session=
 * &state=`. A request without the app's nonce never redirects into an app; it explains instead.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : null);
  // Only "is X configured" is read here; the origin feeds the callback default, which this page never uses.
  const reading = readXConfig(process.env.NEXT_PUBLIC_APP_ORIGIN ?? "");
  const token = (await cookies()).get(X_SESSION_COOKIE)?.value ?? null;
  const session = reading.configured && readSession(reading.config.sessionSecret, token ?? undefined) ? token : null;
  const step = nativeHandoffStep({ state: one(NATIVE_STATE_PARAM), result: one(X_RETURN_PARAM), reason: one(X_REASON_PARAM), configured: reading.configured, session });
  if (step.kind === "begin") redirect(step.to);
  if (step.kind === "app") redirect(`${APP_LINK_SCHEME}://${step.path}`);
  return (
    <div className="container py-8">
      <EmptyState why={NATIVE_AUTH.why} nextAction={{ href: "/trade-from-x", label: NATIVE_AUTH.web }} />
    </div>
  );
}
