# AI Assistant — Mobile Port

`src/screens/AIAssistantScreen.js` ("Ask AI" in the drawer) is a port of the
web dApp's Gemini-backed docs assistant
(`inaya-network-dapp/src/app/api/ai/chat/route.js` +
`inaya-network-dapp/src/app/page.js`'s `handleSendChatMessage`), not a new
implementation. This doc records the investigation findings and decisions
made while porting it, so they don't need rediscovering.

## Architecture

- The mobile screen calls the dApp's existing `/api/ai/chat` route at
  `https://www.inayanetwork.com/api/ai/chat` — the same route the web
  frontend calls. No second backend route was built.
- `GEMINI_API_KEY` lives only on the server (read fresh per-request in
  `route.js`) and is never embedded in the mobile bundle. There is no code
  path anywhere in `inaya-mobile` that calls Gemini or
  `generativelanguage.googleapis.com` directly — checked by grep across
  `src/` and `App.js`.
- Request shape matches the web: `POST { messages }`. The mobile screen
  deliberately does **not** send the web's `walletContext` (live
  staking/PAYG/Corporate Reserve snapshot) — wiring that would mean
  duplicating several other screens' live state into the chat screen just
  for context, which wasn't asked for. The assistant still answers
  knowledge-base questions correctly; it just can't answer
  "what's my balance" the way the wallet-connected web version can.
- Conversation history is plain in-memory React state, not persisted to
  `AsyncStorage` — matches the web version exactly (its `chatMessages` is a
  bare `useState`, confirmed by reading the source, nothing writes it to
  `localStorage`).

## Streaming: why `expo/fetch` instead of the RN global `fetch`

The real risk flagged before writing any code: React Native's built-in
global `fetch` does not support `response.body.getReader()` — Hermes does
not implement `ReadableStream` on it, so `response.body` is `undefined`.
This is a long-standing, still-open React Native core limitation (see
facebook/react-native#37505, #27741), not something specific to this app.
The web's exact `getReader()`-based consumption loop would silently break
on RN's global fetch.

Fixed by importing `fetch` from `expo/fetch` instead:

```js
import { fetch as expoFetch } from 'expo/fetch';
```

Expo SDK 54 (this app is on `expo ~54.0.35`) ships a real native fetch
implementation specifically to support LLM/AI response streaming on React
Native — confirmed by reading Expo's own source
(`node_modules/expo/src/winter/fetch/FetchResponse.ts`), not just trusting
the docs: `FetchResponse.body` is backed by a genuine
`ReadableStream<Uint8Array>`, implemented via a native module
(`ExpoFetchModule`, with native Android/iOS code under
`node_modules/expo/android/.../fetch/`). Requires RN 0.76+ with the New
Architecture enabled — confirmed via `app.json` (`newArchEnabled: true`)
and `package.json` (`react-native: 0.81.5`). No third-party streaming
library was needed.

If `res.body` is ever `null` (not expected in practice, but kept as a
guard), the screen falls back to reading the whole response as text at
once rather than hanging silently.

## Verified backend behavior

Checked directly against the live endpoint (not assumed):

```bash
curl -s -D - -o /dev/null -X POST https://www.inayanetwork.com/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

Returns `200 OK` with `Content-Type: text/plain; charset=utf-8` and
`Transfer-Encoding: chunked` — the route streams correctly and needs no
changes.

**No CORS headers**: neither the `OPTIONS` preflight nor the `POST`
response includes `Access-Control-Allow-Origin`. That's fine for the two
callers this route is actually meant to serve — the web dApp (same-origin)
and native RN apps (CORS is a browser-only enforcement, not something
native `fetch`/`URLSession`/`OkHttp` calls are subject to) — but it does
mean the mobile screen **cannot be functionally verified from a browser**.
Testing this screen via `expo start --web` in a desktop browser fails with
a generic `TypeError: Failed to fetch` and zero recorded network request,
purely because the browser blocks the cross-origin call before it's sent.
This is expected, not a bug — do not "fix" it by adding CORS headers to
the route on the mobile screen's account, since a real device/native build
never hits this restriction.

## Testing status

- UI verified: renders correctly, drawer entry works, greeting/suggested
  prompts display (checked via `expo start --web` preview).
- Backend round-trip verified independently via `curl` (200, chunked
  streaming, matches expected shape).
- Full on-device round-trip (native `expo/fetch` actually streaming into
  this screen) has **not** been verified — the web preview can't prove it
  (see CORS note above) and no physical device/simulator build has been
  run in this environment. This needs a real device or simulator dev
  build (`expo run:ios` / `expo run:android`, or an EAS dev build) to
  fully confirm.
