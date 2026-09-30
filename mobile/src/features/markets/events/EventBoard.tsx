import type { EventMarket } from "@agari/core/types";
import { StyleSheet, View } from "react-native";
import { EVENT_BOARD } from "@/features/markets/events/copy";
import { WordsQuiet } from "../words/parts";
import { EventCard } from "./EventCard";

/**
 * web's events/EventBoard on a phone (C6e, K-070): the committee events the lane set carries (`LaneSet.events`, the same
 * market stream as the lanes), soonest lock first, one card each; with none open, the board's quiet line says so.
 */
export function EventBoard({ events, nowMs }: { events: readonly EventMarket[] | null; nowMs: number }) {
  if (events === null || nowMs === 0) return <WordsQuiet text={EVENT_BOARD.reading} />;
  if (events.length === 0) return <WordsQuiet text={EVENT_BOARD.none} />;
  return (
    <View style={styles.grid}>
      {events.map((market) => (
        <EventCard key={market.marketId} market={market} nowMs={nowMs} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ grid: { gap: 16 } });
