/**
 * `GET /.well-known/apple-app-site-association` (C13a): the file iOS reads to open this site's Window links in the app
 * (universal links), so a Blink's signed share link opens the ticket in the app when it is installed and on the web
 * when it is not. Only Window pages are claimed; everything else stays on the web.
 *
 * The app id (`<Team ID>.<bundle id>`) is configuration, not code: `IOS_APP_ID`, set once the App Store Connect record
 * exists (C11). Unset, the file answers 404 and every link opens on the web, as it does today. The app also lists
 * `applinks:<domain>` under `ios.associatedDomains` (C11 owns the app's identifiers).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_ID = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/;

export function GET() {
  const appId = process.env.IOS_APP_ID?.trim();
  if (!appId || !APP_ID.test(appId)) return new Response(null, { status: 404 });
  const body = {
    applinks: {
      details: [{ appIDs: [appId], components: [{ "/": "/markets/*", comment: "a Window and its signed share link" }] }],
    },
  };
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
