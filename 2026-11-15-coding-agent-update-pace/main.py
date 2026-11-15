# What this checks: how often the three big AI coding agents (Claude Code,
# OpenAI Codex CLI, Google Gemini CLI) ship a new stable version, using the
# public npm registry publish dates.
# Run: python main.py  (add --refresh to download the registry data again first)
import json, re, subprocess, sys, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
PACKAGES = {  # short name -> (data file, npm package)
    "claude code": ("claude-code", "@anthropic-ai/claude-code"),
    "codex cli": ("codex", "@openai/codex"),
    "gemini cli": ("gemini-cli", "@google/gemini-cli"),
}
END = datetime(2026, 11, 15, tzinfo=timezone.utc)   # fixed cut-off so reruns match
DAYS = 90
STABLE = re.compile(r"^\d+\.\d+\.\d+$")  # skip alpha, nightly, preview, platform builds


def refresh():
    (HERE / "data").mkdir(exist_ok=True)
    for fname, pkg in PACKAGES.values():
        url = "https://registry.npmjs.org/" + pkg.replace("/", "%2f")
        d = json.load(urllib.request.urlopen(url))
        out = {"package": pkg, "fetched_utc": datetime.now(timezone.utc).isoformat(),
               "source": url, "time": d["time"]}
        (HERE / "data" / f"{fname}.json").write_text(json.dumps(out, indent=0))


def stable_dates(fname):
    t = json.loads((HERE / "data" / f"{fname}.json").read_text())["time"]
    out = []
    for ver, ts in t.items():
        if ver in ("created", "modified") or not STABLE.match(ver):
            continue
        out.append(datetime.fromisoformat(ts.replace("Z", "+00:00")))
    return sorted(out)


def main():
    if "--refresh" in sys.argv or not (HERE / "data").exists():
        refresh()
    start = END - timedelta(days=DAYS)
    results = {"window": f"{start.date()} to {END.date()} ({DAYS} days)",
               "rule": "stable versions only (x.y.z), npm publish time", "tools": {}}
    for name, (fname, _) in PACKAGES.items():
        all_stable = stable_dates(fname)
        dates = [d for d in all_stable if start <= d < END]
        results["tools"][name] = {
            "stable_releases_last_90d": len(dates),
            "per_week": round(len(dates) / (DAYS / 7), 1),
            "first_stable_ever": all_stable[0].date().isoformat(),
            "stable_releases_all_time": len(all_stable),
            "latest_in_window": dates[-1].date().isoformat() if dates else None,
        }
    (HERE / "results.json").write_text(json.dumps(results, indent=2))

    print(f"stable npm releases, last {DAYS} days ({start.date()} to {END.date()})\n")
    print(f"{'tool':<12}{'releases':>10}{'per week':>11}")
    for name, r in results["tools"].items():
        print(f"{name:<12}{r['stable_releases_last_90d']:>10}{r['per_week']:>11}")
    chart(results, start)


NICE = {"claude code": "Claude Code", "codex cli": "Codex CLI", "gemini cli": "Gemini CLI"}


def chart(results, start):
    # Writes chart.json and draws chart.png with the repo's shared chart style (_style/render.js).
    tools = results["tools"]
    lead = max(tools, key=lambda n: tools[n]["stable_releases_last_90d"])
    month = lambda d: d.strftime("%b").lower()
    spec = {
        "test": "001",
        "type": "bars",
        "title": "How often do AI coding agents ship updates?",
        "subtitle": f"Stable releases on npm, {month(start)} {start.day} to {month(END)} {END.day} {END.year}",
        "data": [{"label": NICE[n], "value": t["stable_releases_last_90d"]} for n, t in tools.items()],
        "note": {"text": f"about {round(tools[lead]['per_week'])} new versions every week"},
        "source": "npm registry, stable x.y.z versions only",
    }
    (HERE / "chart.json").write_text(json.dumps(spec, indent=2))
    render = HERE.parent / "_style" / "render.js"
    try:
        subprocess.run(["node", str(render), "chart.json", "chart.png"], cwd=HERE, check=True)
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"\ncouldn't draw chart.png ({e}). chart.json has the data; see _style/README.md")


if __name__ == "__main__":
    main()
