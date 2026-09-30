# Deck outline (10 slides)

The Rules ask for "a concise presentation (slides or document) covering: the problem and why it matters; the solution and how Canton Network is used; target users and go-to-market thinking; key metrics or validation evidence". There is one idea per slide. Every number must come from `metrics.md` or an interview note.

| # | Title | On the slide | Say | Source |
|---|---|---|---|---|
| 1 | Your position is public in a block | One Polymarket whale-tracker alert (screenshot, with the URL cited). One line: "An industry tracks and copies traders." | The leak, and who exploits it | `materials/01-value-problem-statement.md` |
| 2 | Who pays for the leak | The desk trader persona and **one interview quote** (leave blank until there is one) | Why size stays away | `icp.md`, interview log |
| 3 | A private event-risk desk | One sentence, with the four parts: firm quotes, private positions, re-derivable resolution, batch settlement | Not "Polymarket but private" | `brief.md` |
| 4 | How Canton makes it true | The `Leg` with two signatories; the resolution signed by resolver and venue; the privacy matrix, cut to 5 rows | What leaks on a transparent chain, and what the ledger never sends | `privacy-matrix.md` |
| 5 | Demo | Four screenshots: seat → call → Outsider empty → Sold → proof | The 90-second flow | `demo-script.md`, `docs/evidence/ux/c4b`, `c7a` |
| 6 | Evidence | 43 windows unattended · 160/160 trades · 175 Daml tests · sell-back under 2 s · interviews *N* | Numbers, local sandbox, said plainly | `metrics.md` |
| 7 | Go-to-market | First 10 users table; channels in order | Desks first, then Canton-native routes | `gtm.md` |
| 8 | Business model and flows | The fee curve (0.25% at even odds), the spread, the operator licence; a flow diagram: quote → accept → resolve → settle or void | Who earns what | `gtm.md` "Economic flows" |
| 9 | Built 18 Sep – 9 Oct, and prior work | Tag `hackcanton-s3-start`; the diff stat; 11,679 lines of new Daml; "Agari (Solana) is prior work" | What judges should evaluate | `prior-work-disclosure.md` |
| 10 | Limits and next 90 days | The trust boundary on a shared participant; self-run feeders; demo credits. Then Oct / Nov / Dec goals | Honest scope, then the plan | `regulatory-posture.md`, `gtm.md` |

**Backup slide (for Q&A):** "Isn't this a money-laundering tool?" and "What if your category is banned?". The answers are in `regulatory-posture.md`.

**Competition (optional slide 7b):** Confimarket, Unhedged and our wedge, from `materials/04-gtm.md`.
