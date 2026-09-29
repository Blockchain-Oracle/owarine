# C6 realised-vol re-measure, BTC and ETH (2026-09-29)

The plan requires BTC and ETH realised volatility to be re-measured before their fair values go live ("Prices and lanes"). Until C6 the pricer used a 60 % placeholder, annualised on the equity session clock (252 × 6.5 h), which C3b flagged.

**Method.** `scripts/probes/realised-vol.ts` fetches 1-minute candle closes from the three oracle exchanges. The endpoints are public and keyless, the same ones the feeders print from. Core `realisedVol` then takes the sample standard deviation of log returns between bars exactly 60 s apart, so a gap is never counted as a zero return, and annualises it over the calendar year (365 × 86,400 s), because BTC and ETH trade 24/7. The median of the exchanges is the estimate. Kraken's OHLC endpoint returns only its newest 720 bars, so its column covers 12 h whichever window is asked for.

Measured at 2026-09-29 10:46 UTC:

| Symbol | Window | Coinbase | Kraken (12 h) | Bitstamp | **Median σ** | Placeholder |
|---|---|---|---|---|---|---|
| BTC | 24 h | 38.6 % (1,439 returns) | 29.6 % (719) | 37.1 % (1,439) | **37.1 %** | 60 % |
| BTC | 7 d | 33.7 % (10,079) | 29.6 % (719) | 32.5 % (10,079) | **32.5 %** | 60 % |
| ETH | 24 h | 51.0 % (1,439) | 40.7 % (718) | 50.1 % (1,439) | **50.1 %** | 60 % |
| ETH | 7 d | 43.2 % (10,079) | 40.7 % (718) | 42.6 % (10,079) | **42.6 %** | 60 % |

On the equity clock the same 24 h bars read 16.0 % (BTC, Bitstamp) and 21.7 % (ETH). Combined with the lower level, the placeholder overstated BTC's per-second variance scale by about 0.60 / 0.371 × √(365 × 24 / 1,638) ≈ 3.7×. In practice a 4-minute crypto Window priced near 50/50 long after the price had moved.

**What runs now (C6.2).**

- `services/ops/src/prices/vol-meter.ts` re-measures every 30 min (`VOL_EVERY_MIN`) over the last 24 h (`VOL_WINDOW_MIN`) and keeps the median across the exchanges. It runs inside the venue beside the pricer, and the `vol-meter` heartbeat shows each exchange's figure.
- The pricer prices a crypto Window only on that measured σ, on the 365-day clock (`fair.ts` `yearSec`), or on an explicit `MM_SIGMA_BPS` override. With neither, the Window is not priced and the pricer logs `BTC realised vol not measured yet`. The 60 % entry stays in `DEFAULT_SIGMA_BPS` only to keep the table complete and is never used for crypto.
- Equities, xStocks, pre-IPO names and baskets keep their reference σ table on the session clock, unchanged.

Raw probe output: rerun `pnpm --filter @agari/scripts exec tsx probes/realised-vol.ts` (the numbers move with the market).
