# Released DARs: R1

These four files are what Abu uploads in the Noders Console for release R1 (`docs/plan/runbooks/devnet-r1.md`, step 5), in the order of the table. `scripts/bootstrap/dar.ts` reads the main package id out of each file here and `bootstrap-devnet.ts` checks that exact id on the participant. The files are tracked in Git (K-202), so the uploaded build and the checked build are the same bytes.

- **Build commit:** `5cf2dff` (`main`, "merge(C2d): the maker vault"), a clean tree.
- **Built with:** `dpm build --all` in `daml/` (SDK 3.5.2, dpm 3.5.10), 2026-09-30 04:13–04:14 UTC.
- **Checked:** `sha256` over each file as committed; the package id is the `Main-Dalf` entry of each DAR's `META-INF/MANIFEST.MF`.

| Upload order | File | Package | Version | Main package id | sha256 | Bytes |
|---|---|---|---|---|---|---|
| 1 | `abu-pm-main-0.5.0.dar` | abu-pm-main | 0.5.0 | `076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c` | `e5524a948254a6f39eedd70e027a5d63a3608bbc3fb474d156c21f8839751799` | 1,006,890 |
| 2 | `abu-pm-tickets-0.1.3.dar` | abu-pm-tickets | 0.1.3 | `a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8` | `4ca6c9ff788a7c6c31d91a09db8440685b5485d9f5a4a0343f9a15eaec7f6a84` | 972,967 |
| 3 | `abu-pm-agents-0.2.1.dar` | abu-pm-agents | 0.2.1 | `9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55` | `d3ed0ec4eeb6db0ee4235dad2dfb2cf0f200b0a159a13ca1dbc4494fa59e8be5` | 901,464 |
| 4 | `abu-pm-games-0.1.1.dar` | abu-pm-games | 0.1.1 | `158901a60ff53c2db94c2482a48b03e58cc1e40b05b4c34bebb486e7e7e52023` | `47aab06ecc1f81a129c9afaa87a4b3fb5464c137da9cda67f389076880ded3cc` | 821,078 |

Tickets, agents and games each carry `abu-pm-main-0.5.0-076dbb92….dalf`, the same main package as file 1. The upload order matters because of that.

Check a file before uploading it: `shasum -a 256 daml/released/*.dar`. The hashes must match the table.

## Upgrade check

Nothing is on Noders yet, so R1 is checked against the last local versions. Those are the four packages at `afc7b3b`, the commit before the 0.5.0 bump: main 0.4.0, tickets 0.1.2, agents 0.2.0 and games 0.1.0. They were rebuilt from `git archive afc7b3b daml` outside the repo. The command was:

```
dpm upgrade-check --both \
  <afc7b3b>/abu-pm-main-0.4.0.dar <afc7b3b>/abu-pm-tickets-0.1.2.dar <afc7b3b>/abu-pm-agents-0.2.0.dar <afc7b3b>/abu-pm-games-0.1.0.dar \
  daml/released/abu-pm-main-0.5.0.dar daml/released/abu-pm-tickets-0.1.3.dar daml/released/abu-pm-agents-0.2.1.dar daml/released/abu-pm-games-0.1.1.dar
```

It exited 0 in 14.5 s. It logged 0 WARN or ERROR lines and 33 "succeeded" lines: the 29 `daml-prim`/`daml-stdlib` lineages and our four. Our four lineages, verbatim with the logger prefix removed:

```
Typechecking upgrades for lineage of package-name abu-pm-main.
Package 076dbb9246f8d8c518d5618de206125319d0557c636246eb4fdcd6216ca3263c (abu-pm-main v0.5.0) claims to upgrade package 8cb07279eb4d4eb926bf4f161c8222f9c544962e50dcf9b6352b0bf010c0328d (abu-pm-main v0.4.0)
Typechecking upgrades for lineage of package-name abu-pm-main succeeded.
Typechecking upgrades for lineage of package-name abu-pm-tickets.
Package a441ff5ab84b2396820053e787002fc06ccaaf2fb7186b55a2e98ad1328b33c8 (abu-pm-tickets v0.1.3) claims to upgrade package f5a944b16b225d2a28b847fc165b20f3b23b6fcaace4a66a11186788a74fb56d (abu-pm-tickets v0.1.2)
Typechecking upgrades for lineage of package-name abu-pm-tickets succeeded.
Typechecking upgrades for lineage of package-name abu-pm-agents.
Package 9bf15da97a74b7c317e7448743a70600de86c31e762a1462078a0d68aa462f55 (abu-pm-agents v0.2.1) claims to upgrade package a2b126b654d6836e81e5a6bc32552467d40c6def21ecc47e15b71644354ff379 (abu-pm-agents v0.2.0)
Typechecking upgrades for lineage of package-name abu-pm-agents succeeded.
Typechecking upgrades for lineage of package-name abu-pm-games.
Package 158901a60ff53c2db94c2482a48b03e58cc1e40b05b4c34bebb486e7e7e52023 (abu-pm-games v0.1.1) claims to upgrade package 228f791b67d59bf33a70a2b63fc19e8c59401179a43e1bcafcdcaba26d27c44a (abu-pm-games v0.1.0)
Typechecking upgrades for lineage of package-name abu-pm-games succeeded.
```

## The next release (R2 on)

1. Bump the versions.
2. Run `dpm build --all`.
3. Run `dpm upgrade-check --both` with the DARs in this folder as the old side. Once R1 is on Noders, these are also the versions on the participant.
4. Copy the new DARs here. Keep the old files: the Console cannot delete a DAR, so each released file stays as the record of what went up.
5. Add a section to this file.
