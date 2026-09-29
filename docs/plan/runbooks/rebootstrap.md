# Runbook: re-bootstrap (skeleton)

How to bring the venue back from nothing on a Canton participant: a fresh local sandbox, Noders DevNet after an incident, or Plan B (a Canton sandbox on a VPS, switched by env var). Filled in as C2x, C3 and C4 build the pieces; every step must be ensure-style (create only what is missing, fail loudly on drift).

## Inputs

- Target: local sandbox · Noders DevNet · Plan B (env var) — unknown (written in C3).
- Party set: from the Console (Noders) or allocated by the bootstrap (sandbox, Plan B). Ids in env/`parties.json`, never in docs.
- DARs: the released set in `daml/released/`.
- Database: a separate Postgres per network (sandbox and DevNet never share one).

## Steps (to be written)

1. [ ] Toolchain check (C0 script).
2. [ ] Parties present and rights correct (Noders: Console, **needs Abu**).
3. [ ] DARs uploaded and vetted (Noders: Console, **needs Abu**; see `noders-console.md`).
4. [ ] Bootstrap manifest (`./deploy`): series, oracle list and quorum, venue cash shards (K = 16), reserve.
5. [ ] Projector: empty database replays from the pruning offset; rebuild equals live.
6. [ ] Ops: roller, feeders, pricer/issuer, settler start; `/health` green.
7. [ ] Seat pool: free seats funded with demo cash.
8. [ ] Four-viewpoint smoke; `/status` green from outside.

## Uptime watch (10 – 18 Oct)

External probe from Mon 5; on a node wobble: this runbook, the API bootstrap, the Plan B env flip, and the recorded video as the fallback demo.
