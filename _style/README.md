# Chart style

Every chart in this repo uses the same graph-paper look: a light grid, ink-blue bars, one solid bar for the main result, hatched bars for the rest, and a short red note pointing at what matters.

`render.js` draws a chart from a small JSON file:

```
node _style/render.js chart.json chart.png
```

It needs Node and Playwright with Chromium (`npm i playwright && npx playwright install chromium` if you don't have them). The output is a 3200x1800 PNG. The fonts are in `fonts/` (all under the SIL Open Font License).

## The JSON

Shared fields:

| Field | What it is |
|-------|-----------|
| `test` | The test number, e.g. `"001"` |
| `type` | `"bars"`, `"hbars"`, `"line"` or `"numbers"` |
| `title` | The question the test answers, in plain words |
| `subtitle` | What is measured and over what time |
| `prefix`, `suffix` | Put around every value, e.g. `"$"` or `"%"` |
| `decimals` | Digits after the point (default: 0 for whole numbers, 1 otherwise) |
| `note` | `{"text": "..."}` a short red note that points at the main result |
| `source` | Where the data came from |

### bars (up to 7 items) and hbars (up to 10, or long labels)

```json
{"test": "001", "type": "bars",
 "title": "How often do AI coding agents ship updates?",
 "subtitle": "Stable releases on npm, aug 17 to nov 15 2026",
 "data": [{"label": "Claude Code", "value": 79},
          {"label": "Codex CLI", "value": 39},
          {"label": "Gemini CLI", "value": 13}],
 "note": {"text": "about 6 new versions every week"},
 "source": "npm registry, stable x.y.z versions only"}
```

The biggest value is the solid bar unless another item has `"highlight": true`.

### line

```json
{"type": "line", "x": ["day 1", "day 2", "day 3"],
 "series": [{"label": "new repo", "values": [400, 2100, 5200], "highlight": true},
            {"label": "older launch", "values": [300, 900, 1800]}],
 "note": {"text": "passed 5K stars on day 3", "at": 2}}
```

`note.at` is the x position the note points at (default: the last one).

### numbers (2 to 4 big figures)

```json
{"type": "numbers", "prefix": "$",
 "data": [{"label": "old price", "value": 38, "sub": "per month"},
          {"label": "new price", "value": 12, "sub": "per month", "highlight": true}]}
```

Use `"display"` on an item to show text instead of a formatted number.

## Checks

`render.js` prints a warning when a font didn't load or when text is cut off or runs past the edge. Shorten the title or labels and run it again.
