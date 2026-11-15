# What this checks: how often the three big AI coding agents (Claude Code,
# OpenAI Codex CLI, Google Gemini CLI) ship a new stable version, using the
# public npm registry publish dates.
# Run: python main.py  (add --refresh to download the registry data again first)
import json, re, sys, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

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


def chart(results, start):
    names = list(results["tools"])
    vals = [results["tools"][n]["stable_releases_last_90d"] for n in names]
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=200)
    bars = ax.bar(names, vals)
    ax.bar_label(bars, padding=3)
    ax.set_ylim(0, max(vals) * 1.12)
    ax.set_ylabel("stable releases")
    ax.set_title(f"stable npm releases, {start:%b %-d} - {END:%b %-d %Y}".lower())
    fig.tight_layout()
    fig.savefig(HERE / "chart.png")
    print("\nsaved chart.png")


if __name__ == "__main__":
    main()
