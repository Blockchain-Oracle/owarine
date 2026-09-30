import { shortHex } from "@agari/core/units";
import { xLinkMessage, xUnlinkMessage } from "@agari/core/x";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { X_CARD, X_ERRORS, X_OAUTH_FALLBACK, X_OAUTH_MESSAGES } from "@/features/x/copy";
import type { XStatus } from "@/features/x/protocol";
import { signText, useOwnerWallet, useWalletSession } from "@/lib/wallet-session";
import { signInWithX } from "./x-sign-in";
import { setForwardedXSession, xSessionHeaders } from "./x-session";

export type XBusy = "" | "link" | "unlink" | "sign-in";

const POLL_MS = 15_000;
export const xStatusKey = (wallet: string | null) => ["agari", "x-status", wallet] as const;

async function fetchStatus(wallet: string | null): Promise<XStatus | null> {
  const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
  // C13a: the X session the web handed this app (`/native-auth`) rides in its header, as the web's cookie does.
  const response = await fetch(`/api/x/status${q}`, { cache: "no-store", headers: await xSessionHeaders() });
  return response.ok ? ((await response.json()) as XStatus) : null;
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; body: { ok?: boolean; reason?: string; boundWallet?: string } }> {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...(await xSessionHeaders()) }, body: JSON.stringify(body) });
  return { ok: response.ok, body: (await response.json().catch(() => ({}))) as { ok?: boolean; reason?: string; boundWallet?: string } };
}

/**
 * web's features/x/useXStatus.ts, for the phone. The same two facts — who is signed in with X here (the session) and
 * which account routes to which wallet (the store, read by wallet) — and the same signed link/unlink. The OAuth bounce
 * the web reads off `window.location` is, on the phone, the `/native-auth` handoff (C13a): `signIn` runs X's sign-in in
 * an auth session and keeps the session the web hands back. The status is a React Query read so every screen shares
 * one poll.
 */
export function useXLink() {
  const { address } = useWalletSession();
  const owner = useOwnerWallet();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: xStatusKey(address),
    queryFn: () => fetchStatus(address),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const [busy, setBusy] = useState<XBusy>("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const status = query.data ?? null;
  const session = status?.session ?? null;
  const binding = status?.binding ?? null;
  // Exact match: base58 is case-sensitive (D-010).
  const routedHere = Boolean(address && binding && binding.wallet === address);
  const sessionMatchesBinding = Boolean(session && binding && session.authorId === binding.authorId);
  const walletMismatch = Boolean(address && binding && session && binding.authorId === session.authorId && binding.wallet !== address);
  const needsLink = Boolean(address && session && !walletMismatch && (!routedHere || !sessionMatchesBinding));
  /** Linked from any device: the store routes this account to the connected wallet. */
  const linked = Boolean(binding && routedHere && !needsLink && !walletMismatch);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: xStatusKey(address) });
  }, [queryClient, address]);

  const signIn = useCallback(async () => {
    if (busy) return;
    setError("");
    setOk("");
    setBusy("sign-in");
    try {
      const result = await signInWithX();
      if (!result.ok) {
        if (result.reason !== "cancelled") setError(X_OAUTH_MESSAGES[result.reason] ?? X_OAUTH_FALLBACK);
        return;
      }
      await refresh();
    } catch {
      setError(X_OAUTH_FALLBACK);
    } finally {
      setBusy("");
    }
  }, [busy, refresh]);

  /** Forget the X session on this phone (the route stays, as the web's sign-out leaves it). */
  const signOut = useCallback(async () => {
    await setForwardedXSession(null);
    await refresh();
  }, [refresh]);

  const link = useCallback(async () => {
    if (!address || !session || busy) return;
    setError("");
    setOk("");
    setBusy("link");
    try {
      if (!owner || owner.address !== address) throw new Error(X_ERRORS.linkFailed);
      const issuedAtMs = Date.now();
      const signature = await signText(owner, xLinkMessage(session.authorId, address, issuedAtMs));
      const { ok: fine, body } = await post("/api/x/bind", { wallet: address, issuedAtMs, signature });
      if (!fine || body.ok === false) {
        if (body.reason === X_ERRORS.alreadyLinkedOther && body.boundWallet) {
          throw new Error(`That X account is already pointed at ${shortHex(body.boundWallet)}. Take that seat instead.`);
        }
        throw new Error(body.reason || X_ERRORS.linkFailed);
      }
      setOk(X_CARD.linkedOk);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
    }
  }, [address, session, busy, owner, refresh]);

  const unlink = useCallback(async () => {
    if (!address || !session || !sessionMatchesBinding || busy) return;
    setError("");
    setOk("");
    setBusy("unlink");
    try {
      if (!owner || owner.address !== address) throw new Error(X_ERRORS.unlinkFailed);
      const issuedAtMs = Date.now();
      const signature = await signText(owner, xUnlinkMessage(session.authorId, address, issuedAtMs));
      const { ok: fine, body } = await post("/api/x/unlink", { wallet: address, issuedAtMs, signature });
      if (!fine || body.ok === false) throw new Error(body.reason || X_ERRORS.unlinkFailed);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
    }
  }, [address, session, sessionMatchesBinding, busy, owner, refresh]);

  return {
    status,
    loading: query.isPending,
    failed: query.isError || (query.isSuccess && status === null),
    busy,
    error,
    ok,
    linked,
    needsLink,
    walletMismatch,
    sessionMatchesBinding,
    refresh,
    signIn,
    signOut,
    link,
    unlink,
    setOk,
    setError,
  };
}

export type XLinkState = ReturnType<typeof useXLink>;
