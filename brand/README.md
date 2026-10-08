# Owarine identity

The **終値 seal** is Owarine's mark: the two kanji of *owarine* ("closing price") stacked in a rounded square, stamped at a slight tilt like a hanko. The kanji are outlines from Noto Sans JP Black (OFL), so the files need no font.

| Use | Asset |
| --- | --- |
| On light surfaces | [`owarine-mark.svg`](owarine-mark.svg), [`owarine-mark-1024.png`](owarine-mark-1024.png) |
| On dark surfaces | [`owarine-mark-inverse.svg`](owarine-mark-inverse.svg), [`owarine-mark-inverse-1024.png`](owarine-mark-inverse-1024.png) |
| App icon / social avatar | [`owarine-app-icon.svg`](owarine-app-icon.svg), [`owarine-app-icon-1024.png`](owarine-app-icon-1024.png) |

The seal is one colour: Power Pink `#FA00FF` on light surfaces, white on dark ones and on the pink app tile. In product code it is drawn by the kit's `Seal` (web `web/src/components/kit/Seal.tsx`, app `mobile/src/components/kit/ow/Seal.tsx`), with `currentColor` where a theme should decide.

Until 8 Oct 2026 this folder held Agari's "Window Cut" mark, carried over by the rename; it is retired everywhere.
