# Released DARs: R1

These five files are what Abu uploads in the Noders Console for release R1 (`docs/plan/runbooks/devnet-r1.md`, step 5), in the order of the table. `scripts/bootstrap/dar.ts` reads the main package id out of each file here and `bootstrap-devnet.ts` checks that exact id on the participant. The files are tracked in Git (K-202), so the uploaded build and the checked build are the same bytes.

**Rebuilt in C2e (K-315, K-316).** R1 had still not been uploaded (no R1 upload row in `docs/plan/acceptance.md` on 6 Oct), so `abu-pm-main` 0.5.2 (a private call pays back into the seat's private bucket, and its receipt says so) replaces 0.5.1 as the R1 main DAR, exactly as 0.5.1 replaced 0.5.0 in C7c (K-235). `abu-pm-main-0.5.1.dar` and the four dependents built against it are removed from this folder: nothing was ever on Noders under them. This time the dependents **bump** their versions (tickets 0.1.4, agents 0.2.2, games 0.1.2, cc 0.1.1) instead of keeping them: rebuilt against a new main they are new content, and a participant (or `dpm upgrade-check`) refuses a second package with the same name and version (`KNOWN_PACKAGE_VERSION`, K-316). With the bump, a local sandbox that already loaded the 0.5.1 set takes this set as an upgrade instead of having to start fresh, and each dependent has an upgrade check against its 0.5.1-based build.

- **Build commit:** `e425f5d` (`slice/C2e-private-payout`, "feat(C2e.1/daml): a private call pays back into the private bucket, abu-pm-main 0.5.2").
- **Built with:** `dpm build --all` in `daml/` (SDK 3.5.2, dpm 3.5.10), 2026-10-06. Reproduced from `git archive e425f5d daml` in a clean directory (09:25–09:27 UTC): all five files byte for byte the same.
- **Checked:** `sha256` over each file as committed; the package id is the `Main-Dalf` entry of each DAR's `META-INF/MANIFEST.MF`.

| Upload order | File | Package | Version | Main package id | sha256 | Bytes |
|---|---|---|---|---|---|---|
| 1 | `abu-pm-main-0.5.2.dar` | abu-pm-main | 0.5.2 | `f29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a` | `cf3dcc7c41cf4509c304720bc15161e8821f36a7284c16fe71c84118ab426c85` | 1,072,093 |
| 2 | `abu-pm-tickets-0.1.4.dar` | abu-pm-tickets | 0.1.4 | `6b1d6533919e3674ce50d06785cedd308972d2b485f07be05301df5c15dec7bb` | `4c015ce2ecfd938a1a5fb2e2eb90dd0c4192af142fd8aa1b6a25dfd3d35d8543` | 1,000,082 |
| 3 | `abu-pm-agents-0.2.2.dar` | abu-pm-agents | 0.2.2 | `6787ea8c069df109641f11774d2dcbe283b6ed968366e31521bf0bc455110cf4` | `111127bce80e2af8b0920d4c7609c900ffd5a2fe2bae62c074e5b5bdcd452b7a` | 928,392 |
| 4 | `abu-pm-games-0.1.2.dar` | abu-pm-games | 0.1.2 | `1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6` | `9cf0f8b20b4362c297fbc1c1aedcb09f1ec80fed223e6766ff5bad1c8bdb4f39` | 848,022 |
| 5 | `abu-pm-cc-0.1.1.dar` | abu-pm-cc | 0.1.1 | `f8586e803801c43edee5b1edbe7be0006dedcd7fee1c172d8b61653b575c6745` | `d4249bc8d42a084e40eee68090eb8b50f51ca0a7e6c1233c61fb85655fdfd648` | 1,095,623 |

Tickets, agents, games and cc each carry `abu-pm-main-0.5.2-f29dde00….dalf`, the same main package as file 1, and no other main. The upload order matters because of that. Besides main, cc carries the three token-standard V1 API packages (`splice-api-token-metadata-v1`, `-holding-v1`, `-transfer-instruction-v1`, all 1.0.0) as before (K-249); the vendored copies match the hashes in `daml/vendor/splice/README.md`.

Check a file before uploading it: `shasum -a 256 daml/released/*.dar`. The hashes must match the table.

**What changed from the 0.5.1 set.** Main: `Leg_Settle`, `Leg_Claim` and `Leg_RefundStale` pay a user's leg tagged `beneficiaryRef = Some "private"` into the `private` bucket (won, lost, void, stale), and `SettlementReceipt` gains `paidInto : Optional Text` as its last field (Some "private" there, None everywhere else). Tickets: its receipts set `paidInto = None`. Agents, games and cc: no source change, only the new main.

**Earlier R1 builds, never uploaded.** C7c (K-235, 30 Sep): main 0.5.1 `27a40a47…` with tickets 0.1.3 `b818b4a1…`, agents 0.2.1 `b7d263f0…`, games 0.1.1 `806a6f6e…`, built at `2a4339b`; cc 0.1.0 `2d0e83fb…` was added on 6 Oct (K-249, built at `448a85f`). Before that, C2z's rehearsal set on main 0.5.0 `076dbb92…`. The files are in Git history at `016574c` and `1b41384`.

## Upgrade check

Nothing is on Noders yet, so this set is checked against the 0.5.1 set it replaces: the five files committed in this folder at `016574c`. The command, from `daml/`, with those files still in place:

```
dpm upgrade-check --both \
  released/abu-pm-main-0.5.1.dar released/abu-pm-tickets-0.1.3.dar released/abu-pm-agents-0.2.1.dar released/abu-pm-games-0.1.1.dar released/abu-pm-cc-0.1.0.dar \
  abu-pm-main/.daml/dist/abu-pm-main-0.5.2.dar abu-pm-tickets/.daml/dist/abu-pm-tickets-0.1.4.dar abu-pm-agents/.daml/dist/abu-pm-agents-0.2.2.dar \
  abu-pm-games/.daml/dist/abu-pm-games-0.1.2.dar abu-pm-cc/.daml/dist/abu-pm-cc-0.1.1.dar
```

It exited 0 in 19.2 s (2026-10-06 09:27:51 UTC). It logged 0 WARN or ERROR lines and 37 "succeeded" lines: the 29 `daml-prim`/`daml-stdlib`/`ghc-stdlib` lineages, the three token-standard API lineages and our five. Our five, verbatim with the logger prefix removed:

```
Typechecking upgrades for lineage of package-name abu-pm-main.
Package f29dde00cb60f10b09382093a6d9650d3f79e8fb30b451d26f8a5086764cb53a (abu-pm-main v0.5.2) claims to upgrade package 27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 (abu-pm-main v0.5.1)
Typechecking upgrades for lineage of package-name abu-pm-main succeeded.
Typechecking upgrades for lineage of package-name abu-pm-tickets.
Package 6b1d6533919e3674ce50d06785cedd308972d2b485f07be05301df5c15dec7bb (abu-pm-tickets v0.1.4) claims to upgrade package b818b4a14026edf4f349772dc08873bb79a32e965db20ab77cc52f5fe4cc78f4 (abu-pm-tickets v0.1.3)
Typechecking upgrades for lineage of package-name abu-pm-tickets succeeded.
Typechecking upgrades for lineage of package-name abu-pm-games.
Package 1afe8bf16a66b2f02af067752fff92f64225b051df9d387695957f0a86e46cc6 (abu-pm-games v0.1.2) claims to upgrade package 806a6f6eb3891d93ddb2b141597504dbe03649b971e12daffe65ccb69db81aca (abu-pm-games v0.1.1)
Typechecking upgrades for lineage of package-name abu-pm-games succeeded.
Typechecking upgrades for lineage of package-name abu-pm-cc.
Package f8586e803801c43edee5b1edbe7be0006dedcd7fee1c172d8b61653b575c6745 (abu-pm-cc v0.1.1) claims to upgrade package 2d0e83fb6f37b7bd8cc007bb16cdf5d5df813af3469480a45153ea58a28b45ea (abu-pm-cc v0.1.0)
Typechecking upgrades for lineage of package-name abu-pm-cc succeeded.
Typechecking upgrades for lineage of package-name abu-pm-agents.
Package 6787ea8c069df109641f11774d2dcbe283b6ed968366e31521bf0bc455110cf4 (abu-pm-agents v0.2.2) claims to upgrade package b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589 (abu-pm-agents v0.2.1)
Typechecking upgrades for lineage of package-name abu-pm-agents succeeded.
```

Main alone, `dpm upgrade-check --both released/abu-pm-main-0.5.1.dar abu-pm-main/.daml/dist/abu-pm-main-0.5.2.dar`, also exited 0 with 0 WARN or ERROR lines and 30 "succeeded" lines (the stdlib lineages and main).

Why keeping the dependents' versions would not pass: the same check with tickets left at 0.1.3 stops at `KNOWN_PACKAGE_VERSION(8,0): Tried to vet two packages with the same name and version: b818b4a1… (abu-pm-tickets v0.1.3) and c601f0ed… (abu-pm-tickets v0.1.3)` and exits 1, which is what a participant holding the old file would answer too.

The 0.5.1 set itself passed against main 0.4.0, tickets 0.1.2, agents 0.2.0 and games 0.1.0 (`afc7b3b`) and against main 0.5.0 (C7c, `2a4339b`; `docs/plan/acceptance.md`). None of those older versions was ever on Noders either, so the 0.5.1 set is the only old side that matters for R1.

## The next release (R2 on)

1. Bump the versions.
2. Run `dpm build --all`.
3. Run `dpm upgrade-check --both` with the DARs in this folder as the old side. Once R1 is on Noders, these are also the versions on the participant.
4. Copy the new DARs here. Keep the old files: the Console cannot delete a DAR, so each released file stays as the record of what went up.
5. Add a section to this file.
