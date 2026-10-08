# DevNet release R2: the resting exit and credit transfers

R2 is one new DAR, `abu-pm-seat` 0.1.0 (revamp step 4): Trail, stops and take-profits that the venue fills on the ledger even with the seat's tab closed, Close through an armed exit in one venue command, and sending credits between seats. R1 does not change. Package id and sha256 are in `daml/released/MANIFEST.md` ("R2"). Never write a credential, token or party id into this file.

## What Abu clicks (about 2 minutes)

1. Sign in to the Noders Console ("Sign in with Authfactory"; type the password yourself).
2. Console → **Collections** → **Upload DAR** → pick the HackCanton node → choose `daml/released/abu-pm-seat-0.1.0.dar` → **Upload**. Wait until it shows as vetted.

The file picker cannot be reached by the agent's tools: copy the full path, then ⌘⇧G ⌘V in the picker. Before uploading, `shasum -a 256 daml/released/abu-pm-seat-0.1.0.dar` must print `1b6b33a9dba5faa27f9762b5a490d861c58883869125ced00d0ee1c60ad04d3a`. If the Console says a package with that name and version already exists with different content, stop and tell the agent.

## What the agent does after

1. `GET /v2/packages` shows `9f73ecb7…` (the bootstrap's check-only run lists all six release packages present).
2. Restart ops (`stop-ops.sh`, then `start-ops-main.sh` with the same Series). On start the exit keeper logs `created the venue's TransferDesk`.
3. Restart the web. `GET /api/ledger/exits` answers `deployed: true` for a seat; TP / SL and Send appear, and TRAIL reads "On the ledger".
4. Live check with a browser seat on a CC or BTC Window: buy UP, arm TP / SL, see the `RestingExit` on the ledger; Close through it; send credits to a second seat and accept. Write the update ids into `docs/evidence/r2-exit-send.md` ("DevNet run").

## Until it is uploaded

Nothing breaks. The web reads `deployed: false` (Trail runs in the tab as before, TP / SL and Send stay hidden), and the exit keeper idles with "abu-pm-seat is not on the participant yet (R2)". The DevNet bootstrap's check-only run reports the sixth package missing.
