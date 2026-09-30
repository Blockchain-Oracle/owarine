# BitSafe challenge: governed resolution

**Entry:** the BitSafe "Decentralizing Apps on Canton" **Contribution pool** (LocalNet). **Not Gold.** Applying for Gold forfeits the pool, the Gold application closes 4 October, and there is no node with an Admin API (plan, "Add-ons"; `context/10-bitsafe-decentralization/entry-strategy.md`).

**Status on Wed 30 Sep 2026, 08:30 UTC.** The Daml is built, and all 14 of its Daml Script tests pass. They run on BitSafe's own released `GovernanceRules`. **Nothing has run on a multi-node LocalNet or through the Decentralization Manager yet.** See [Go / no-go](#go--no-go).

## The risk, in one paragraph

A prediction market's only irreversible act is settlement. In the engine as shipped (`abu-pm-main` 0.5.0), only the market's `resolver` party can create an `OpenPrint` or a `Resolution`. That party is already separate from the venue: the venue cannot resolve at all (`Test.Resolution.testVenueCannotResolve`). But `resolver` is still one party with one key on one node, and the same operator runs it. Whoever holds that key decides which prints count, when a market resolves, and whether it resolves or voids. **Governed resolution makes the resolver a Decentralized Party.** Recording a print, resolving, voiding and changing the resolution rules each need a threshold of independent members, and the ledger records who confirmed. "Trust the operator" becomes "trust that 2 of 3 members do not collude", and the ledger shows which it was.

## Before and after

```
BEFORE (abu-pm-main 0.5.0, today)          AFTER (abu-pm-governance 0.1.0)
venue   signs Series, MarketTerms, quotes   venue   unchanged: lists, quotes, settles (hot path, no vote)
resolver  one key, one node                 resolver = a Decentralized Party (DecMan onboarding)
  ├ Terms_RecordOpen                          namespace 2-of-3 · hosting on 3 nodes, confirmation threshold 2
  ├ Terms_Resolve / Terms_Void                · signing keys 2-of-3
  └ Event_Resolve / Event_Void                GovernanceRules {members m1 m2 m3, threshold 2, timeout 1 h,
                                                               additionalProposers = {venue}}
                                              ├ ResolveMarketProposal → the same five engine choices
                                              ├ PolicyProposal        → ApprovedRules (oracle set, quorum, policy)
                                              ├ VenueModeProposal     → VenueMode (open / reduce-only / paused)
                                              └ DelegationProposal    → ResolverDelegation (routine price Windows)
```

`abu-pm-main` does not change. The engine's own checks (quorum, deviation, deadlines, single use) still decide every resolution, and Legs settle against the same `Resolution` as before. Governance decides **who may pull the trigger, and under which rules**.

## What is built

| Piece | Where | What it does |
|---|---|---|
| BitSafe's interface and engine, vendored | `daml/vendor/bitsafe/` | `governance-action-v1` (the `GovernableAction` interface) and `governance-core-v1` (`GovernanceRules`), the released v1 DARs byte for byte, with Apache-2.0 `LICENSE` and `NOTICE`, hashes and package ids. These are the packages the Decentralization Manager deploys on a node. |
| `abu-pm-governance` 0.1.0 | `daml/abu-pm-governance/` | A new package. Every proposal implements BitSafe's `GovernableAction`, so the Decentralization Manager's confirm and execute endpoints drive it with no server change. |
| (a) Resolve or void a market | `PM/Governance/Resolve.daml` | `ResolveMarketProposal` covers: record the open print, resolve or void a price Window, and resolve or void an event, through the engine's `Terms_RecordOpen`, `Terms_Resolve`, `Terms_Void`, `Event_Resolve` and `Event_Void`. The committee votes on an outcome: a resolve names the expected side, and execution fails (`abu-pm/outcome-mismatch`) if the evidence says otherwise. Each proposal is bound to one market and carries its own expiry. |
| (b) Rotate the oracle set or quorum | `PM/Governance/Rules.daml`, `Policy.daml` | A vote approves a Series' rules by content: policy, oracle set, quorum and deviation limit (`ApprovedRules`). The venue applies them with `Rules_Apply`, which runs the engine's own `Series_AddPolicyVersion`, so the rotation arrives as a new policy version from the next unopened Window. A governed open or resolve needs the Window listed under approved rules (`abu-pm/rules-not-approved`). A rotation the venue makes alone can therefore only end in a void, which refunds every user. Voids never need approval. |
| (c) Pause the venue | `PM/Governance/Venue.daml` | `VenueMode` (open, reduce-only or paused) is signed by the governed party alone, so only a vote can move it. User exits never check it. |
| Routine Windows without a vote each | `PM/Governance/Delegate.daml` | A vote appoints an ops delegate (`ResolverDelegation`) for price Windows only; events are never delegated. The delegate is still bound by approved rules and every engine check. Any single guardian can hold a market for the committee, and a vote revokes the delegate. This is the challenge's own line: *"Governance applies only to the actions selected by the application. Routine transactions can continue without an approval step."* |
| Money-gate tests | `daml/pm-tests/daml/Test/Governance/` | 13 tests plus the driver test below, all on BitSafe's `GovernanceRules`: committee of three, threshold 2, the venue as an additional proposer. |
| LocalNet driver | `Test/Governance/LocalNet.daml` | The venue's and the oracles' half of the LocalNet demo, one `dpm script` per step. `testLocalNetDriver` runs it on the IDE ledger with each REST vote simulated. |

**No engine hook was needed.** `abu-pm-main` stays at 0.5.0, byte-identical to `daml/released/`.

### The tests (`dpm test`, all green on 30 Sep)

| Test | Shows |
|---|---|
| `Resolve.testProposeConfirmExecute` | Execute fails at 0 and at 1 confirmation with BitSafe's own `The requirement 'Enough confirmations to execute action' was not met.` It succeeds at 2. The `GovernanceExecutionResult` records `ResolveMarket`, both confirmers and the executor, and the confirmations are consumed. |
| `Resolve.testOneConfirmationPerMember` | A member's second confirmation never counts (`No duplicate confirmers`), and the same confirmation cannot be spent twice. The venue and a user cannot confirm, and cannot even see the committee without hosting the governed party. A user's own proposal cannot be confirmed. |
| `Resolve.testStaleProposalExpires` | Confirmations lapse after the one-hour timeout (`Confirmation has expired`). The proposal lapses at its own expiry (`abu-pm/proposal-expired`), and fresh confirmations do not revive it. The proposer withdraws it, and a fresh vote still voids the market. |
| `Resolve.testExecuteExactlyOnce` | An executed proposal cannot be confirmed or executed again. A second vote on the same market, to resolve or to void, fails in the engine's single-use chain. One `Resolution`, one audit record. |
| `Resolve.testVenueAloneCannotResolve` | The venue cannot resolve through the engine, write a `Resolution`, execute its own proposal, or act as executor. Nor can one member: reading as the governed party gives no authority, and a member cannot forge another member's confirmation. |
| `Resolve.testOutcomeAndMarketBound` | Evidence that resolves differently from the confirmed outcome fails the whole execution. A proposal naming another market fails. |
| `Parity.testGovernedSettlesLikePlain` | Two Windows, the same trade and the same prints: one is decided by a vote, the other by the single-key resolver command. The payouts (10,000 each), the fee (37 each) and the `Resolution` content are equal. The same holds for a void (refund 6,200 + 37 each). |
| `Parity.testGovernedEvent` | An event resolved by vote (YES), whose leg settles. |
| `Policy.testRotateOracleSet` | The rotation vote fails below threshold, then passes. The venue applies it as policy version 2 from the next Window: oracle3 out, oracle4 in, quorum 3. The old rules no longer cover the new Window, and oracle3's print no longer counts. The retired rules are archived by vote. |
| `Policy.testUnilateralRotationOnlyVoids` | The venue drops the quorum to 1 on its own, and Alice trades on the resulting Window. The committee will not record its open (`rules-not-approved`), so after the deadline a vote voids it and Alice gets 6,237 back. Approved rules apply only to their own Series. |
| `Venue.testPauseByVote` | The venue cannot write or archive its own mode. A pause below threshold fails and one at threshold executes. A vote on a replaced mode fails, and so does a vote to the current mode. Alice's claim still works while paused. Reopening takes another vote. |
| `Delegate.testDelegateResolvesRoutine` | With no grant, the ops party cannot act as the resolver. Granted, it records and resolves a Window with one command each. It is refused a Series outside its grant and a market a guardian holds, and the committee decides the held market. Once revoked, it has nothing left to act through. |
| `Delegate.testGovernancePrivacy` | Users and outsiders see no governance contract, on any of the ten templates. Members see proposals, votes and results through the governed party they host. A member party that does not host it sees nothing. The venue sees only its own proposals, the approved rules, the mode and the delegation. |
| `LocalNet.testLocalNetDriver` | The LocalNet driver end to end on the IDE ledger. |

Reproduce:

```bash
export PATH="$HOME/.dpm/bin:$PATH"
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; export PATH="$JAVA_HOME/bin:$PATH"
cd daml && dpm build --all && (cd pm-tests && dpm test --files daml/Test/Governance/*.daml)
shasum -a 256 vendor/bitsafe/*.dar      # must match vendor/bitsafe/README.md
```

The full Daml gate (`dpm build --all && (cd pm-tests && dpm test)`) ran on the final tree on 30 Sep at 08:24 UTC and finished in 1 min 15 s: 188 tests and 14 setup scripts, 0 failures. The governance tests are 14 of those 188; the other 174 are unchanged. `pnpm invariants` reported 0 errors and 0 warnings.

## What Daml alone shows, and what it stands in for

Everything above runs on **one participant** (the Daml Script IDE ledger), so the governed party there is an ordinary local party. Here is what corresponds to what:

| On the network (Decentralized Party via the Decentralization Manager) | In the tests (Daml alone) |
|---|---|
| The party's namespace is a `DecentralizedNamespaceDefinition` of 3 member keys, threshold 2. No member can add a host, rotate a key or remove a member alone. | Not modelled: topology is not Daml. |
| The party is hosted on 3 participants with **confirmation threshold 2**, so a bogus transaction needs 2 colluding node operators. | Not modelled. |
| **A party with confirmation threshold above 1 cannot submit Ledger API commands at all** (`decentralization.mdx`). It acts only through choices that members exercise. | `GovernanceRules` and the genesis `VenueMode` are created by submitting as the governed party. On the network, the Decentralization Manager's contracts workflow signs them with k of n member keys. The settlement-parity test also submits the plain resolver command as that party, as the "before" baseline. **No other test submits as the governed party.** |
| Each member's node hosts the governed party with readAs rights, which is how members see proposals. BitSafe's `Rules.daml` deliberately makes members non-observers. | Members submit as `actAs member <> readAs governed-party`. The privacy test shows a member party *without* that hosting sees nothing. |
| Members confirm and execute over `POST /governance/confirm` and `/execute`, each on their own node. | `GovernanceRules_ConfirmAction` and `_ExecuteConfirmedAction`: the same choices of the same package, called directly. |
| Canton's rule, verbatim: *"if the governance rules in the Daml model require a threshold of `t`, then the confirmation threshold `ct` should also be at least `t`. Otherwise, `ct` colluding Participant Node operators could simply agree to commit the effects of a governance action without even going through the governance."* | Planned setting: Daml threshold 2 and confirmation threshold 2, so ct ≥ t. |

**Member set and operators, stated plainly.** Three members, each with its own member party on its own participant: the Splice LocalNet app-provider, app-user and SV nodes. **On LocalNet all three are operated by Abu**, as are the venue and the three oracles. Nothing about that is independent, and the demo says so. In production the three members would be three separate organisations, with Abu's company holding at most one seat. Nobody has been asked (candidates: BitSafe, a node-operator-network member, a market-data provider). *"Multiple nodes alone do not prove independent control or outage tolerance"*, and this entry does not claim otherwise.

### Known limits (stated before a judge finds them)

- **Liveness stays with the venue.** The venue signs `Series` and `MarketTerms`, so it can decline to list a market. It can also change its own Series, but then only a void (refund) is possible, never a payout. A venue that ignores approved rules loses its markets; it cannot win them.
- **A dispute on a price Window has the close admission to act in** (120 s under `policy1`). After that, only a void is possible. The LocalNet demo series admits for 30 minutes, and a governed event series should admit for hours.
- **The pause binds software, not the ledger.** `Desk_IssueQuote` does not read `VenueMode` (no engine change), and the issuer check (parity C-DAML-02) is not wired in ops yet. A venue that ignored a pause would leave every quote it issued afterwards on the ledger, dated.
- **2 of 3 can still certify a wrong outcome.** The engine's oracle quorum and deviation checks bound what they can certify on a price market. On an event, the members' attestations are the authority by construction, and the audit trail is public.
- **A single guardian can delay, never pay.** Holding a market only moves it to the vote. The committee can revoke a delegate, and replace one, by vote.
- **The ops resolver actor** (`services/ops/src/actors/resolver`) still submits as the resolver party. It moves to the `Delegate_*` choices (`actAs` delegate, `readAs` venue) only when the resolver becomes a Decentralized Party, which is a LocalNet-only story. The shared DevNet sandbox *"isn't set up to host teams' Decentralized Parties"*, so on Noders the resolver stays an ordinary party. The choice has to be made before markets are created: a local party cannot become a Decentralized Party later.

## The challenge's criteria, verbatim, and the evidence

The criteria below are quoted from BitSafe's challenge sheet (https://bitsafe.notion.site/BitSafe-Challenge-Decentralizing-Apps-on-Canton-3db636dd0ba5804ba3e0ec08aec56638, captured in the knowledge base as `.firecrawl/bitsafe-notion-challenge-sheet.md`). *"Every project receives a score from 1 to 5 on four criteria. Contribution pool entries are judged on their reproducible LocalNet work."*

| Criterion (verbatim) | What judges look for (verbatim) | Useful evidence (verbatim) | Ours |
|---|---|---|---|
| Application relevance | Does decentralization solve a real problem in the application? | Risk statement, affected workflow, before-and-after architecture | The risk paragraph and the before/after above. The affected workflow is settlement itself: every Leg pays against the `Resolution` the governed party creates. |
| Decentralization and originality | Does the design remove unilateral control or a single hosting dependency, and does it contribute something distinct? | Node or member set, threshold, failure test, governance scope, reusable contribution | 3 members, threshold 2, ct ≥ t. The failure tests: below-threshold, venue alone, one member alone. Governance scope: resolution, rules, mode and delegation, with nothing on the hot path. **Distinct:** approval of rules by content, so a unilateral rotation can only refund; the outcome-bound vote; a delegate with a single-guardian hold. |
| Working implementation | Does the flow work end to end? | Reproducible setup, completed action, test results, event or audit reference | **Daml:** 14 green tests on BitSafe's `GovernanceRules`, with `GovernanceExecutionResult` as the audit reference. **Not yet:** the flow through the Decentralization Manager on a multi-node LocalNet. This is the gap (see the run plan). |
| Path beyond the hackathon | Contribution pool: Can others reuse or build on the LocalNet work? Gold: Can the deployed application continue operating and developing beyond the hackathon? | Contribution pool: reusable code, setup instructions, remaining work. Gold: node and operator plan, remaining work, named technical owner | Any Canton market can reuse `abu-pm-governance`'s pattern, and it depends only on BitSafe's interface. The run plan below has the setup; the remaining work is listed there. |

*"Evidence of decentralization"* (verbatim): *"**Shared control:** Show that a governed action cannot execute below the required confirmation threshold, then succeeds when the threshold is met."* Shown in Daml (`testProposeConfirmExecute`, `testPauseByVote`, `testRotateOracleSet`), not yet on nodes. *"**Distributed hosting:** Show how the application behaves when a hosting node goes offline, including whether it remains available under the configured hosting threshold."* Not shown; it needs the multi-node run (step 8 below). *"Identify the nodes and their operators, state the relevant thresholds, and explain which operators are independent."* Stated above.

*"Judges will reward honest scope. A smaller integration that works and addresses a real risk will score above a broad design that cannot be reproduced."*

## What the LocalNet / multi-node run adds

1. **The Decentralized Party itself.** It adds a real `abu-pm-resolver::1220…` with a shared namespace, 3 hosts and confirmation threshold 2, created by the Decentralization Manager's onboarding workflow in 30 to 41 s (measured 21 Sep).
2. **The on-camera failure pair, through the product BitSafe ships.** `POST /governance/execute` with one confirmation fails with `Enough confirmations to execute action`; after the second, the same call succeeds.
3. **The refusal Daml cannot show.** Submitting a command *as* the resolver from any single node is refused, because the party's confirmation threshold is 2.
4. **The outage test** (distributed hosting). Stop one participant, and the governed resolution still completes at 2 of 3. Stop a second, and it stalls until a node returns.
5. **Package distribution and vetting** of `abu-pm-main`, `abu-pm-governance` and BitSafe's v1 DARs across three nodes.

## Run plan for a night with the machine free

These commands come from the knowledge base (`context/10-bitsafe-decentralization/local-run-report.md` §2–§10, `framework-deep-dive.md` §5) and BitSafe's docs (`docs/USE_CASES.md`, `docs/CUSTOM_DAML_TEMPLATES.md` at `7b4966d`). Budget: about 60 min to the first workflow on a cold machine, then about 30 min for our steps. One person, one machine, nothing else running.

**0. Preconditions (stop if any fails).**
- Every lane is stopped, with no `dpm sandbox` and no ops.
- `docker ps` shows no stack of ours.
- OrbStack's VM is at **12 GB or more** (Settings → Memory; 8.39 GB timed out on 21 Sep).
- `df -h ~` shows at least 12 GiB free, and `uptime` shows a 1-minute load under 10.

**1. Build our DARs first.** Never build next to a running LocalNet.

```bash
export PATH="$HOME/.dpm/bin:$PATH"
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; export PATH="$JAVA_HOME/bin:$PATH"
cd /Users/abu/dev/hackathon/hackcanton-pm/daml && dpm build --all && (cd pm-tests && dpm test --files daml/Test/Governance/*.daml)
```

**2. The framework, at the audited commit, from the local reference copy.**

```bash
git clone /Users/abu/dev/hackathon/canton-season3/refs/community/decentralization-manager ~/dev/hackathon/decman-run
cd ~/dev/hackathon/decman-run && git log -1 --format=%h        # 7b4966d
protoc --version || brew install protobuf                        # libprotoc 36.2 installed 21 Sep
just gen-types                                                   # 8 min; mandatory on a fresh clone
```

**3. First bring-up.** The harness downloads the 725 MB LocalNet bundle (about 8 min), then stops at `couldn't find env file … compose.env`. The pinned bundle no longer ships the compose files, so stage them from the tagged source and run again:

```bash
./integration-tests/run.sh
git clone --depth 1 --branch v0.6.12 --filter=blob:none --sparse \
  https://github.com/digital-asset/decentralized-canton-sync.git ~/dev/hackathon/dcs-sparse
(cd ~/dev/hackathon/dcs-sparse && git sparse-checkout set cluster/compose/localnet)
mkdir -p .localnet/splice-node/docker-compose
cp -R ~/dev/hackathon/dcs-sparse/cluster/compose/localnet .localnet/splice-node/docker-compose/localnet
```

**4. Hold the stack up.** The command below builds (7.5 min), pulls images (about 5 GB, about 20 min cold) and waits for splice to be healthy (about 13 min cold; 22 × `503` first is normal). Press ENTER to run BitSafe's own suite. On 21 Sep, at 8.39 GB, it stopped at DAR distribution before reaching any governed action. After the suite, the stack stays up with the UIs on `http://localhost:8081`, `:8082` and `:8083`. **Go/no-go point:** if the suite's `deploy_gov_core` / `generic_vote` phases fail on 12 GB, stop here.

```bash
DECPM_E2E_HOLD=1 ./integration-tests/run.sh
```

**5. Our party, packages and committee** (second terminal).

```bash
# peer ids of nodes 2 and 3 from their UIs; the member party of each node likewise
curl -X POST http://localhost:8081/onboarding -H 'Content-Type: application/json' \
  -d '{"party_id_prefix":"abu-pm-resolver","peer_ids":["<node2 peer id>","<node3 peer id>"]}'
# accept the invitation in the :8082 and :8083 UIs; DP=abu-pm-resolver::1220…

cd /Users/abu/dev/hackathon/hackcanton-pm/daml
b64() { base64 -i "$1" | tr -d '\n'; }
curl -X POST http://localhost:8081/dars/distribute -H 'Content-Type: application/json' -d "{\"dar_files\":[
  {\"filename\":\"governance-action-v1-0.1.0.dar\",\"data\":\"$(b64 vendor/bitsafe/governance-action-v1-0.1.0.dar)\"},
  {\"filename\":\"governance-core-v1-0.1.0.dar\",\"data\":\"$(b64 vendor/bitsafe/governance-core-v1-0.1.0.dar)\"},
  {\"filename\":\"abu-pm-main-0.5.0.dar\",\"data\":\"$(b64 abu-pm-main/.daml/dist/abu-pm-main-0.5.0.dar)\"},
  {\"filename\":\"abu-pm-governance-0.1.0.dar\",\"data\":\"$(b64 abu-pm-governance/.daml/dist/abu-pm-governance-0.1.0.dar)\"}],
  \"peer_ids\":[\"<node2 peer id>\",\"<node3 peer id>\"]}"

# GovernanceRules v1: 3 members, threshold 2, 1 h confirmations, no additional proposers yet
curl -X POST http://localhost:8081/contracts -H 'Content-Type: application/json' -d '{
  "decentralized_party_id":"<DP>",
  "participant_ids":["<node1>","<node2>","<node3>"],
  "participant_parties":["<member1>","<member2>","<member3>"],
  "operator_party":"<member1>",
  "contracts":[{"id":"governance-rules","name":"GovernanceRules","package_id":"#governance-core-v1",
    "module_name":"Governance.Rules","entity_name":"GovernanceRules","fields":[
      {"type":"decentralized_party"},
      {"type":"party_set","parties":["<member1>","<member2>","<member3>"]},
      {"type":"int64","value":2},
      {"type":"rel_time","microseconds":3600000000},
      {"type":"none"}]}]}'
curl "http://localhost:8081/governance/state?party_id=<DP>"     # R=<GovernanceRules cid>
```

The genesis `VenueMode` is a second entry in the same `/contracts` call, in field order `governanceParty, venue, mode, reason, since, seq`. Leave it out if the field types do not fit on the night; the pause is not what this run is judged on.

**6. The venue and oracles; the venue becomes an additional proposer.** Write the harness's `MOCK_TOKEN` (from `integration-tests/env.sh`, a public LocalNet test token) to a file, and never copy it into this repo.

```bash
cd /Users/abu/dev/hackathon/hackcanton-pm/daml/pm-tests
S="dpm script --dar .daml/dist/pm-tests-0.1.0.dar --ledger-host localhost --ledger-port 3901 --access-token-file $HOME/.config/agari/localnet-token"
echo '"<DP>"' > /tmp/b2-gov.json
$S --script-name Test.Governance.LocalNet:allocateLocal --input-file /tmp/b2-gov.json --output-file /tmp/b2-parties.json
# core_self vote: governance_add_additional_proposer = the venue id from /tmp/b2-parties.json
curl -X POST http://localhost:8081/governance/confirm -H 'Content-Type: application/json' -d '{"party_id":"<DP>","rules_contract_id":"<R>","action":{"type":"governance_add_additional_proposer","additional_proposer":"<venue>"},"governance_type":"core_self"}'
curl -X POST http://localhost:8082/governance/confirm …same body…
curl -X POST http://localhost:8081/governance/execute …same body plus "confirmation_cids":[…]…
```

If the token cannot allocate parties, allocate the four parties on participant 1 by the JSON API (`POST /v2/parties`) and write `/tmp/b2-parties.json` by hand.

**7. The governed flow, with the failure on camera.** Each vote uses the same two helpers. The proposal id comes from the step's output file, and the confirmation ids from `GET /governance/confirmations?party_id=<DP>`.

```bash
vote() { curl -s -X POST "http://localhost:$1/governance/$2" -H 'Content-Type: application/json' -d "{\"party_id\":\"<DP>\",\"rules_contract_id\":\"<R>\",\"action\":{\"type\":\"generic_vote\",\"description\":\"x\"},\"governance_type\":\"core_domain\",\"proposal_cid\":\"$3\"$4}"; }
$S --script-name Test.Governance.LocalNet:proposeRules --input-file /tmp/b2-parties.json --output-file /tmp/b2-p1.json
vote 8082 confirm <P1>; vote 8083 confirm <P1>; vote 8081 execute <P1> ',"confirmation_cids":["<c2>","<c3>"],"disclosed_contracts":[]'
$S --script-name Test.Governance.LocalNet:listMarket --input-file /tmp/b2-parties.json --output-file /tmp/b2-listed.json
$S --script-name Test.Governance.LocalNet:proposeOpen --input-file /tmp/b2-listed.json --output-file /tmp/b2-p2.json
vote 8082 confirm <P2>
vote 8081 execute <P2> ',"confirmation_cids":["<c2>"],"disclosed_contracts":[]'          # FAILS: Enough confirmations to execute action
vote 8083 confirm <P2>
vote 8081 execute <P2> ',"confirmation_cids":["<c2>","<c3>"],"disclosed_contracts":[]'    # succeeds: OpenPrint
# 600 s later (Window expiry + 5 s):
$S --script-name Test.Governance.LocalNet:proposeClose --input-file /tmp/b2-listed.json --output-file /tmp/b2-p3.json
vote 8082 confirm <P3>; vote 8083 confirm <P3>; vote 8081 execute <P3> ',"confirmation_cids":["<c2>","<c3>"],"disclosed_contracts":[]'
$S --script-name Test.Governance.LocalNet:outcomeOf --input-file /tmp/b2-listed.json          # Some (Some SideUp)
curl "http://localhost:8081/contracts/query?party_id=<DP>&package_id=%23governance-core-v1&module_name=Governance.ExecutionResult&entity_name=GovernanceExecutionResult&interface=false"
```

Also try one refusal: submit any command with `actAs` `<DP>` on node 1, for example `Terms_Resolve` through the JSON API's `POST /v2/commands/submit-and-wait`. It must be refused, because the party's confirmation threshold is 2.

**8. The outage test (distributed hosting).** Repeat step 7 on Window 1 with node 3's participant disconnected from the synchronizer: it completes at 2 of 3. With nodes 2 and 3 both down, it stalls. Bring one back, and it completes. On Splice LocalNet the three participants share one `canton` container, so the disconnect is a participant-level operation, not a container stop. Call it simulated.

**9. Record and tear down.** Screen-record steps 7 and 8. Then Ctrl-C the harness, and check `docker ps` and ports 8081–8083 and 9001–9003. If `canton` or `postgres` are still up, run `docker rm -f canton splice postgres` (they survived on 21 Sep). Write the evidence to `docs/evidence/b2-bitsafe-localnet.md`: every command, its output, and the audit contract ids.

### Remaining work

- Steps 4–9 above, first hand: the Decentralization Manager flow, the direct-submit refusal, and the outage.
- Wiring the ops resolver to the `Delegate_*` choices on LocalNet, and the issuer's `VenueMode` check (C-DAML-02). Both are ops work, not in this lane.
- A 3-minute demo cut and the README section for the submission.
- Optional upstream contributions, found while running, which only Abu can send:
  - the missing `protoc` prerequisite;
  - `just gen-types` being mandatory on a fresh clone;
  - the stale "four crates" line;
  - the LocalNet compose-files fix in `integration-tests/env.sh`.

## Go / no-go

**Today (Wed 30 Sep): no-go for the multi-node run; the Daml side is done.** The machine is overloaded: the 1-minute load average was 155 at 07:56 UTC, and the lane brief rules out Docker and the 12 GB VM today. So nothing on this page has run through the Decentralization Manager or on more than one participant. The plan's gate is unchanged: *"one unattended overnight run Wed 30. No first-hand propose → confirm → execute by Thu 1 morning, the lane stops."* If the gate fails, the entry is the Daml package, its 14 tests and this run plan. That is below the pool's bar (*"Design-only entries and presentations without a working demo are not eligible"*), so without step 7 on LocalNet there is no BitSafe submission. The salvage is the upstream fixes and the run report.
