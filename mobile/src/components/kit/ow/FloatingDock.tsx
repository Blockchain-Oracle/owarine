import { Link, type Href } from "expo-router";
import { Search, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OW_TYPE, useTheme } from "~/theme";
import { haptic } from "../haptics";
import { Seal } from "./Seal";

/** UGLYCASH's phone navigation (web components/kit/FloatingDock): black dock, two destinations around the mark. */
export interface DockItem {
  href: Href;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

export function FloatingDock({ left, right, centreHref = "/", onSearch }: { left: DockItem; right: DockItem; centreHref?: Href; onSearch?: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + 10 }]}>
      <View style={[styles.dock, { backgroundColor: color.ow.black }]}>
        <DockLink item={left} />
        <Link href={centreHref} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Home" onPress={() => haptic.select()} style={[styles.centre, { backgroundColor: color.ow.pink }]}>
            <Seal size={30} tone="white" />
          </Pressable>
        </Link>
        <DockLink item={right} />
      </View>
      {onSearch ? <SearchPill onPress={onSearch} tall /> : null}
    </View>
  );
}

function DockLink({ item }: { item: DockItem }) {
  const { color } = useTheme();
  const ink = item.active ? color.ow.white : color.ow.whiteDim;
  const Icon = item.icon;
  return (
    <Link href={item.href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected: !!item.active }} onPress={() => haptic.select()} style={styles.link}>
        <Icon size={20} color={ink} strokeWidth={2.25} />
        <Text style={[OW_TYPE.body(11, "600"), { color: ink }]}>{item.label}</Text>
      </Pressable>
    </Link>
  );
}

/** The search entry point: a pill that opens search (assets, Windows, events, people, clubs). */
export function SearchPill({ onPress, label = "Search for anything", tall }: { onPress: () => void; label?: string; tall?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="search" accessibilityLabel={label} style={[styles.search, { backgroundColor: color.ow.card, height: tall ? 64 : 48 }]}>
      <Search size={18} color={color.ow.muted} strokeWidth={2.5} />
      <Text numberOfLines={1} style={[OW_TYPE.body(15, "500"), { color: color.ow.muted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  dock: { height: 64, borderRadius: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
  centre: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  link: { minWidth: 64, height: 48, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 32, paddingHorizontal: 20, flexShrink: 1 },
});
