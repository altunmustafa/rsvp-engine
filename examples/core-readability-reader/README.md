# Readability with RSVP Core

A private browser example showing how an application can fetch or accept a pasted HTML document, extract its plain article text with `@mozilla/readability`, and pass that text to the public `@rsvp-engine/core` API. Fetching only fills the editable page-source field; parsing reads only that field. Readability's HTML output is not rendered.

The browser enforces CORS. A URL works only when its server permits cross-origin reads; `dev.to` is one example of a CORS-enabled site. The example intentionally does not depend on a third-party CORS proxy.

To use copied HTML instead, leave **Article URL** empty, paste the complete document into **Page source**, edit it if needed, then select **Parse page source**.

From the repository root:

```bash
pnpm dev --filter=@rsvp-engine/example-core-readability-reader
```

Open the local URL printed by Vite, then perform this browser smoke test:

1. Confirm that **Play**, **Pause**, and **Stop** start disabled.
2. Enter an article URL whose server allows CORS, then select **Fetch page source**.
3. Confirm that the editable **Page source** field is populated but playback remains disabled.
4. Edit the fetched source if desired, then select **Parse page source**.
5. Confirm that metadata and extracted plain text appear and playback controls become enabled.
6. Clear the URL, paste another complete HTML document into **Page source**, parse it, and confirm that this works without a URL.
7. Select **Play** and confirm that words and progress advance.
8. Change **Words per minute**, then confirm that playback speed changes.
9. Confirm that **Pause** preserves the current position and **Play** resumes it.
10. Confirm that **Stop** resets the displayed word and progress.

To check error handling, enter a non-HTML URL or a URL that rejects CORS and confirm that fetching fails without replacing the source field. Then paste a document without enough readable content and confirm that parsing reports the problem.
