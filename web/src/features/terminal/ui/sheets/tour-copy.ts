import { networkLabel } from "@owarine/markets/chain";

/** The five-step tour's words (Tradash's tour, Owarine's product) and the line that names the network. */
export const TOUR_STEPS = [
  { title: "Watch the market", body: "A live, buttery-smooth price chart is always front and center. That's your whole workspace — no forms, no clutter." },
  { title: "Tap UP or DOWN", body: "Think the price closes higher? Tap UP. Think it drops? Tap DOWN. One tap opens your call instantly — and only you and the venue can see it." },
  { title: "Watch your PnL move", body: "Your profit or loss updates live on the price line as the market moves — green when you're up, red when you're down." },
  { title: "Trail to lock profit", body: "Once you're in profit, tap Trail. It follows the price your way and auto-closes if it reverses — locking in your gains for you." },
  { title: "Close to bank it", body: "Tap Close anytime to take your profit (or cut a loss). That's the whole loop — watch, tap, manage, close." },
] as const;

/** Said on every step: where this runs and what the money is. */
export const tourNetworkNote = (): string => `This is ${networkLabel()}: demo credits only, no real money.`;
