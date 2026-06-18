# Internal documents — NOT deployed publicly

These are the editable source files for the team. They are intentionally
kept OUT of `brickx/docs/` so they are **not** served on docs.brickxprotocol.io.

- `BRICKX_Whitepaper_v2.docx` — editable source of the whitepaper. The public,
  read-only whitepaper is the web page at `brickx/docs/index.html`
  (docs.brickxprotocol.io), which also offers "Download as PDF".
- `BRICKX_PitchDeck_v4.pptx` — investor pitch deck (internal / on request only).
- `BRICKX_Financial_Model_v3.xlsx` — financial model (internal only).

No Vercel project uses `brickx/internal` as a root directory, so nothing here
is published. If the whitepaper text changes, update `brickx/docs/index.html`
(the public source of truth) — and this `.docx` if you want the editable copy
to stay in sync.
