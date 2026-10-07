import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { OW_TYPE, useTheme } from "~/theme";
import { Seal } from "./Seal";

/**
 * The PnL share card as a keychain charm (web components/kit/ShareCharm). A plain View so react-native-view-shot can
 * capture it for the share sheet; `ref` is the node to capture.
 */
export const ShareCharm = forwardRef<View, { call: string; result: string; win: boolean; handle?: string; footnote?: string }>(function ShareCharm({ call, result, win, handle, footnote }, ref) {
  const { color } = useTheme();
  return (
    <View ref={ref} collapsable={false} style={styles.wrap}>
      <Svg width={64} height={56} viewBox="0 0 64 56" style={styles.ring}>
        <Circle cx={32} cy={18} r={15} fill="none" stroke={color.ow.chain} strokeWidth={5} />
        <Rect x={29} y={32} width={6} height={24} rx={3} fill={color.ow.chain} />
      </Svg>
      <View style={[styles.tag, { backgroundColor: color.ow.cream, borderColor: color.ow.white }]}>
        <View style={[styles.hole, { backgroundColor: color.ow.canvas }]} />
        <Text style={[OW_TYPE.display(30), { color: color.ow.black }]}>{call}</Text>
        <Text style={[OW_TYPE.display(76), styles.result, { color: win ? color.ow.win : color.ow.lose }]}>{result}</Text>
        <View style={styles.foot}>
          <View>
            {handle ? <Text style={[OW_TYPE.body(13, "600"), { color: color.ow.black }]}>${handle}</Text> : null}
            <Text style={[OW_TYPE.body(13, "600"), { color: color.ow.black, opacity: 0.6 }]}>{footnote ?? "Private on Canton"}</Text>
          </View>
          <Seal size={54} tone="black" />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: 300, alignSelf: "center", alignItems: "center", paddingTop: 40 },
  ring: { position: "absolute", top: 0 },
  tag: { width: "100%", borderRadius: 32, borderWidth: 3, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 28, transform: [{ rotate: "-3deg" }] },
  hole: { position: "absolute", top: 14, left: "50%", marginLeft: -8, width: 16, height: 16, borderRadius: 8 },
  result: { marginTop: 12 },
  foot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 20 },
});
