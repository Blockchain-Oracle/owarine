import { redirect } from "next/navigation";

/** `/trade` opens on BTC, as Tradash's default market. */
export default function TradeIndex() {
  redirect("/trade/BTC");
}
