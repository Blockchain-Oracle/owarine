import { createMMKV } from "react-native-mmkv";
import { APP_IDENTITY } from "./identity";

/**
 * The app's synchronous key-value store: what localStorage is to web (theme, remembered choices, the intent journal).
 * Its instance id comes from app.identity.json (K-126), so it never shares a file with the reference app's `agari` store.
 */
export const storage = createMMKV({ id: APP_IDENTITY.mmkvId });
