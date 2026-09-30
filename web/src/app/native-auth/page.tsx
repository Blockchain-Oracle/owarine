import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { APP_LINK_SCHEME } from "@/features/canton-ux/seat/link";
import { readXConfig } from "@/features/x/config.server";
import { NATIVE_AUTH } from "@/features/x/copy";
import { nativeHandoffStep, NATIVE_CHALLENGE_PARAM, NATIVE_STATE_PARAM } from "@/features/x/native-handoff";
import { X_REASON_PARAM, X_RETURN_PARAM } from "@/features/x/protocol";
import { readSession, X_SESSION_COOKIE } from "@/features/x/session.server";

export const metadata: Metadata = { title: NATIVE_AUTH.title };
export const dynamic = "force-dynamic";

/**
 * `/native-auth` — the X sign-in handoff into the app (plan "Social, X and share": the blocked plate gets a job; C13a,
 * K-145; hardened C4d M2a, K-212). The app opens `/native-auth?state=<nonce>&challenge=<S256>` in an auth session. Not
 * signed in, this runs the ordinary X sign-in and comes back here; signed in, it asks the person to confirm, and only
 * that tap (a same-site form post to `/api/x/native-code`) sends the app a one-time code on its own scheme
 * (`APP_LINK_SCHEME`, kept equal to the app identity's by the `mobile-identity` invariant). The app trades the code and
 * its verifier for the session; the session never goes into a URL. A request without the app's nonce and challenge
 * never redirects into an app; it explains instead.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : null);
  // Only "is X configured" is read here; the origin feeds the callback default, which this page never uses.
  const reading = readXConfig(process.env.NEXT_PUBLIC_APP_ORIGIN ?? "");
  const token = (await cookies()).get(X_SESSION_COOKIE)?.value ?? null;
  const session = reading.configured ? readSession(reading.config.sessionSecret, token ?? undefined) : null;
  const step = nativeHandoffStep({
    state: one(NATIVE_STATE_PARAM), challenge: one(NATIVE_CHALLENGE_PARAM), result: one(X_RETURN_PARAM), reason: one(X_REASON_PARAM), configured: reading.configured,
    session: session ? { handle: session.handle } : null,
  });
  if (step.kind === "begin") redirect(step.to);
  if (step.kind === "app") redirect(`${APP_LINK_SCHEME}://${step.path}`);
  if (step.kind === "consent") {
    return (
      <div className="container py-8">
        <form method="post" action="/api/x/native-code" className="mx-auto flex max-w-md flex-col gap-4 text-center">
          <h1 className="text-lg font-semibold">{NATIVE_AUTH.consentTitle}</h1>
          <p className="text-sm text-muted-foreground">{NATIVE_AUTH.consentWhy(step.handle)}</p>
          <input type="hidden" name={NATIVE_STATE_PARAM} value={step.state} />
          <input type="hidden" name={NATIVE_CHALLENGE_PARAM} value={step.challenge} />
          <Button type="submit">{NATIVE_AUTH.consentCta(step.handle)}</Button>
        </form>
      </div>
    );
  }
  return (
    <div className="container py-8">
      <EmptyState why={NATIVE_AUTH.why} nextAction={{ href: "/trade-from-x", label: NATIVE_AUTH.web }} />
    </div>
  );
}
