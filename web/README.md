# Owarine web app

Next.js app for the Canton prediction market. See the [root README](../README.md) for the product, trust boundary, current evidence and full local venue setup.

```sh
pnpm dev
pnpm --filter web typecheck
```

Copy [`.env.example`](.env.example) to `.env.local` and fill the server configuration for a local venue. The browser authenticates a leased seat; ledger credentials stay on the server. Public release links are parsed by [`release.ts`](src/lib/release.ts). The prepared [demo cover](public/demo/cover.png) is editorial artwork; a Canton film is not published yet.
