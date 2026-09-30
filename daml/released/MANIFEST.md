# Released DARs: R1

These four files are what Abu uploads in the Noders Console for release R1 (`docs/plan/runbooks/devnet-r1.md`, step 5), in the order of the table. `scripts/bootstrap/dar.ts` reads the main package id out of each file here and `bootstrap-devnet.ts` checks that exact id on the participant. The files are tracked in Git (K-202), so the uploaded build and the checked build are the same bytes.

**Rebuilt in C7c (K-235).** R1 had not been uploaded, so `abu-pm-main` 0.5.1 (the pre-open `RestingCall`, new templates and choices only) replaces 0.5.0 as the R1 main DAR, and `abu-pm-main-0.5.0.dar` is removed from this folder: nothing was ever on Noders under it. Tickets, agents and games keep their versions, because none was uploaded either, but they are rebuilt against main 0.5.1, so their package ids changed (the table below is the new set). A local sandbox that already loaded the old 0.5.0-based files must be started fresh: the same name and version cannot be uploaded twice.

- **Build commit:** `2a4339b` (`slice/C7c-resting-call`, "feat(C7c.1/daml): the pre-open resting call, abu-pm-main 0.5.1"), a clean tree.
- **Built with:** `dpm build --all` in `daml/` (SDK 3.5.2, dpm 3.5.10), 2026-09-30 09:16 UTC.
- **Checked:** `sha256` over each file as committed; the package id is the `Main-Dalf` entry of each DAR's `META-INF/MANIFEST.MF`.

| Upload order | File | Package | Version | Main package id | sha256 | Bytes |
|---|---|---|---|---|---|---|
| 1 | `abu-pm-main-0.5.1.dar` | abu-pm-main | 0.5.1 | `27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580` | `b78a2e917a60e671164125ed4324f7619be05a07076a7d6180ad01ad0e15ad52` | 1,069,099 |
| 2 | `abu-pm-tickets-0.1.3.dar` | abu-pm-tickets | 0.1.3 | `b818b4a14026edf4f349772dc08873bb79a32e965db20ab77cc52f5fe4cc78f4` | `df495f78d4eda8c89e37585654cc115981c5d45f6938b5fd18fc37b4222a401f` | 999,245 |
| 3 | `abu-pm-agents-0.2.1.dar` | abu-pm-agents | 0.2.1 | `b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589` | `8f4b15ddbea6ec2fa88b47ae6ca468cb91166f5bfeec311d38042cc10d99e15b` | 927,738 |
| 4 | `abu-pm-games-0.1.1.dar` | abu-pm-games | 0.1.1 | `806a6f6eb3891d93ddb2b141597504dbe03649b971e12daffe65ccb69db81aca` | `f33cd041dbeaf8700df4207277cb230549c0fde233ca8d2a1493e0f82622a33d` | 847,353 |

Tickets, agents and games each carry `abu-pm-main-0.5.1-27a40a47….dalf`, the same main package as file 1. The upload order matters because of that.

Check a file before uploading it: `shasum -a 256 daml/released/*.dar`. The hashes must match the table.

## Upgrade check

Nothing is on Noders yet, so R1 is checked against the last local versions. Those are the four packages at `afc7b3b`, the commit before the 0.5.0 bump: main 0.4.0, tickets 0.1.2, agents 0.2.0 and games 0.1.0. They were rebuilt from `git archive afc7b3b daml` outside the repo. The command was:

```
dpm upgrade-check --both \
  <afc7b3b>/abu-pm-main-0.4.0.dar <afc7b3b>/abu-pm-tickets-0.1.2.dar <afc7b3b>/abu-pm-agents-0.2.0.dar <afc7b3b>/abu-pm-games-0.1.0.dar \
  daml/released/abu-pm-main-0.5.1.dar daml/released/abu-pm-tickets-0.1.3.dar daml/released/abu-pm-agents-0.2.1.dar daml/released/abu-pm-games-0.1.1.dar
```

It exited 0 in 14.3 s. It logged 0 WARN or ERROR lines and 33 "succeeded" lines: the 29 `daml-prim`/`daml-stdlib` lineages and our four. Our four lineages, verbatim with the logger prefix removed:

```
Typechecking upgrades for lineage of package-name abu-pm-main.
Package 27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 (abu-pm-main v0.5.1) claims to upgrade package 8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d (abu-pm-main v0.4.0)
Typechecking upgrades for lineage of package-name abu-pm-main succeeded.
Typechecking upgrades for lineage of package-name abu-pm-tickets.
Package b818b4a14026edf4f349772dc08873bb79a32e965db20ab77cc52f5fe4cc78f4 (abu-pm-tickets v0.1.3) claims to upgrade package f5a944b16b225d2a28b847fc165b20f3b23b6fcaace4a66a11186788a74fb56d (abu-pm-tickets v0.1.2)
Typechecking upgrades for lineage of package-name abu-pm-tickets succeeded.
Typechecking upgrades for lineage of package-name abu-pm-agents.
Package b7d263f0d201e75f2a284fbf75c0da8b0d42dd2e806bf157d944e46b3197c589 (abu-pm-agents v0.2.1) claims to upgrade package a2b126b654d6836e81e5a6bc32552467d40c6def21ecc47e15b71644354ff379 (abu-pm-agents v0.2.0)
Typechecking upgrades for lineage of package-name abu-pm-agents succeeded.
Typechecking upgrades for lineage of package-name abu-pm-games.
Package 806a6f6eb3891d93ddb2b141597504dbe03649b971e12daffe65ccb69db81aca (abu-pm-games v0.1.1) claims to upgrade package 228f791b67d59bf33a70a2b63fc19e8c59401179a43e1bcafcdcaba26d27c44a (abu-pm-games v0.1.0)
Typechecking upgrades for lineage of package-name abu-pm-games succeeded.
```

The second check is 0.5.1 against the 0.5.0 the R1 rehearsal used (`076dbb92…`, the file this release replaced, taken from Git at `1b41384`):

```
dpm upgrade-check --both <1b41384>/daml/released/abu-pm-main-0.5.0.dar daml/released/abu-pm-main-0.5.1.dar
```

It exited 0, logged 0 WARN or ERROR lines and 30 "succeeded" lines (the 29 stdlib lineages and main):

```
Typechecking upgrades for lineage of package-name abu-pm-main.
Package 27a40a47feb36cca946fb08a56d1020e9673c26a8b40a206380778fb5c9ad580 (abu-pm-main v0.5.1) claims to upgrade package 076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c (abu-pm-main v0.5.0)
Typechecking upgrades for lineage of package-name abu-pm-main succeeded.
```

The dependents are not checked against their own 0.5.0-based builds: those share a name and version with the rebuilt files and were never on any participant, so there is no lineage between them.

## The next release (R2 on)

1. Bump the versions.
2. Run `dpm build --all`.
3. Run `dpm upgrade-check --both` with the DARs in this folder as the old side. Once R1 is on Noders, these are also the versions on the participant.
4. Copy the new DARs here. Keep the old files: the Console cannot delete a DAR, so each released file stays as the record of what went up.
5. Add a section to this file.
