# Runbook: submission snapshot

From `00-plan.md`, "Submission snapshot" (the reference's soak-worktree pattern). The judged build is always a promoted snapshot, never a development deploy.

## Daily snapshot (from Mon 5 Oct)

1. Find the last `main` commit on which every gate is green: fast, web, Daml, and `dpm upgrade-check` against Noders.
2. Tag it `snap-N` (N counts up from 1).
3. Promote it only if all of these pass, each an `acceptance.md` row:
   - all gates;
   - `upgrade-check` against the DARs on Noders;
   - the live four-viewpoint smoke (owner, second seat, outsider, venue);
   - `/status` green from outside;
   - the capability registry: nothing `live` without its gate and acceptance row;
   - a link check.
4. Build the judged web URL from a detached `live` worktree at `snap-N`. Development deploys go elsewhere.

## Video and submission

- **Wed 7 Oct evening:** the video, after the C7a gate, recorded against `snap-N` (Abu).
- **Thu 8 Oct:** tag `submission` on the promoted snapshot; public-release audit; repo public; submit (Abu fills the form). Every link opened in a private window.
- **Until Fri 9 Oct 20:00 UTC:** a later snapshot replaces it only by passing promotion.
- **After the deadline:** no DAR goes to Noders until Mon 19 Oct.

## The phone

Wave 2 reaches the phone by dependency. JS-only work ships by `expo-updates` to the approved build. A final build goes to the approved public group on Thu 8 morning.

## Before submitting

Secret scan; link check; the prior-work tag `hackcanton-s3-start` present; `git log hackcanton-s3-start..submission` shows only in-window work; the README's prior-work section updated with the diff stat.
