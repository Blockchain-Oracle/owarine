# BitSafe governance DARs (vendored)

Two released packages from BitSafe's Decentralization Manager ("Canton Decentralized Party Manager"), copied byte for byte so `abu-pm-governance` builds against exactly what the Decentralization Manager deploys on a node.

| File | Package id (Main-Dalf) | sha256 | Used by |
|---|---|---|---|
| `governance-action-v1-0.1.0.dar` | `48acd500fc0bc9e4f00d52270122a104a68157f6d5561328f059f5eb6a63fd61` | `4fc7912df4a0aeea3cfcc6ba07c880192a5fa88f7c75ed04b922602461b1e485` | `abu-pm-governance` (the `GovernableAction` interface), `pm-tests` |
| `governance-core-v1-0.1.0.dar` | `361d1f2857f833f8094caf86ecdd5daaa3e2075c22dafe2bf18cde63ee98d488` | `b8d05903e63288d4114632f41386491cea215e177183514ea032fe35d24a9544` | `pm-tests` only (`GovernanceRules`, `GovernanceConfirmation`, `GovernanceExecutionResult`) |

- **Source:** https://github.com/DLC-link/decentralization-manager, `releases/v1/`, at commit `7b4966d` (2026-09-21). Both DARs were built by BitSafe with SDK 3.4.11, LF target 2.2; they load as `data-dependencies` under this repo's SDK 3.5.2 unchanged.
- **Licence:** Apache License 2.0 ([`LICENSE`](LICENSE)); the upstream [`NOTICE`](NOTICE) is kept beside the files as the licence requires. Copyright 2026 BitSafe Finance (DLC-Link, Inc.).
- `governance-core-v1` carries `splice-util-0.1.4` inside it, so no Splice DAR needs vendoring.
- **Check:** `shasum -a 256 daml/vendor/bitsafe/*.dar` must match the table.
- **Never edited.** A new upstream release is a new file and a new row here.
