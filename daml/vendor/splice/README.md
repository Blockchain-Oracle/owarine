# Canton token standard DARs (vendored)

Released Daml packages from the Splice repository (Digital Asset, Linux Foundation Decentralized Trust), copied byte for byte so `abu-pm-cc` builds against exactly the interfaces every registry, Canton Coin included, implements, and so `pm-tests` can drive a real (test) registry.

| File | Package id (Main-Dalf) | sha256 | Used by |
|---|---|---|---|
| `splice-api-token-metadata-v1-1.0.0.dar` | `4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f` | `455eb160cb5abd4ae9918a6fbb9dad471f721adda39f0e5c76feef08d05637fc` | `abu-pm-cc` (`ExtraArgs`, `Metadata`) |
| `splice-api-token-holding-v1-1.0.0.dar` | `718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b` | `ef75f8eb41a65810221784fdb78bb9dfac7cb22245aba14fa7cb7f69c34e0175` | `abu-pm-cc` (`Holding`, `InstrumentId`) |
| `splice-api-token-transfer-instruction-v1-1.0.0.dar` | `55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281` | `e4c73aa7ae73fb2fc330b938ffb99f568792321640ba4b9472902aa8d742c994` | `abu-pm-cc` (`TransferFactory`, `TransferInstruction`) |
| `splice-test-token-v1-1.0.1.dar` | `da294b5651ed00af8565fd31351d0c1d8778f10393d250e32c9844311f681436` | `824f0c64bf235bcb9b4ca6fb471e80358488a6d16f124a35fc0f5ddc8666c74b` | `pm-tests` only: the token standard's own mock registry (`Token`, `TokenRules`), never uploaded to a participant |

- **Source:** https://github.com/canton-network/splice (`daml/dars/`; the Hyperledger Labs / LF Decentralized Trust project), checked out at commit `fda19e6` (main at 0.9.0, 2026-09-15). All four were built by Digital Asset with SDK 3.5.2, LF target 2.1; they load as `data-dependencies` under this repo's SDK 3.5.2 unchanged. The sources are `token-standard/splice-api-token-*-v1/` and `token-standard/examples/splice-test-token-v1/` in that repository.
- **Licence:** Apache License 2.0 ([`LICENSE`](LICENSE), copied from the repository root). The sources carry `Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates` and `SPDX-License-Identifier: Apache-2.0`; the repository has no NOTICE file.
- **Why V1 and not V2:** CIP-0056 V1 is the baseline every registry supports and Canton Coin implements both; the transfer-instruction flow below needs only the receiver's authority. V2 (CIP-0112) allocations settle with executor authority only, which is what a wallet user outside our participant would need; see `context/11-wallet-and-deployment/grofty-custom-package-feasibility.md` §3b and `docs/evidence/c7b-canton-coin.md`.
- **The test token is not a registry we would run.** It exists to prove the rail's Daml against the token standard's own interfaces (`TokenRules` is a `TransferFactory`; a transfer is a `TransferInstruction` pending the receiver's acceptance). Canton Coin's own DARs are not vendored: they need a running DSO.
- **Check:** `shasum -a 256 daml/vendor/splice/*.dar` must match the table.
- **Never edited.** A new upstream release is a new file and a new row here.
