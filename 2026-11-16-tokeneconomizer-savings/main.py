# What this checks: Microsoft's free TokenEconomizer plugin says it makes coding agents
# (Claude Code, Codex, Copilot CLI) 18.4% to 30.9% cheaper to run. This script takes the
# per-setup numbers the project publishes, checks they match the headline claim, and turns
# "X% cheaper" into the plain question people care about: how much more work fits in the
# same budget or usage limit.
# Run: python main.py  (add --refresh to download the numbers from GitHub again first)
import json, re, subprocess, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
REPO_RAW = "https://raw.githubusercontent.com/microsoft/TokenEconomizer/main/"
FIGURE_SCRIPT = "docs/assets/results_overview.py"   # the paper's Table 1 rows, as the repo plots them
README = "README.md"                                # the headline claim and per-setup numbers in words


def refresh():
    (HERE / "data").mkdir(exist_ok=True)
    for name in (FIGURE_SCRIPT, README):
        text = urllib.request.urlopen(REPO_RAW + name).read().decode()
        (HERE / "data" / Path(name).name.replace(".py", ".py.txt")).write_text(text)


def table_rows():
    # (agent, model, cost change %, s.d., pass rate before, pass rate after) from the figure script
    src = (HERE / "data" / "results_overview.py.txt").read_text()
    block = src[src.index("ROWS = ["):src.index("]", src.index("ROWS = ["))]
    pat = r'\("([^"]+)", "([^"]+)", (-?[\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)'
    return [(a, m, float(c), float(sd), float(p0), float(p1)) for a, m, c, sd, p0, p1 in re.findall(pat, block)]


def readme_claims():
    # second source: the numbers written out in the README text
    text = (HERE / "data" / "README.md").read_text()
    head = re.search(r"([\d.]+)[–-]([\d.]+)% lower mean cost", text)
    per = re.findall(r"([\d.]+)% (?:lower )?and (?:Pass@1 )?([+−-][\d.]+)", text)
    return (float(head.group(1)), float(head.group(2))), [(float(c), float(p.replace("−", "-"))) for c, p in per]


def main():
    if "--refresh" in sys.argv or not (HERE / "data").exists():
        refresh()
    rows = table_rows()
    (lo, hi), per = readme_claims()
    assert len(rows) == len(per) == 5, f"expected 5 setups, got {len(rows)} rows and {len(per)} in README"

    setups = []
    for (agent, model, cost, sd, p0, p1), (rc, rp) in zip(rows, per):
        saved = -cost / 100
        assert abs(-cost - rc) < 0.05, f"cost mismatch for {agent} {model}"
        assert abs((p1 - p0) - rp) < 0.05, f"pass rate mismatch for {agent} {model}"
        setups.append({
            "setup": f"{agent} + {model}",
            "cheaper_pct": round(-cost, 1),
            "more_work_same_budget_pct": round((1 / (1 - saved) - 1) * 100, 1),
            "tasks_solved_before_pct": p0, "tasks_solved_after_pct": p1,
            "solved_change_points": round(p1 - p0, 1),
        })
    costs = [s["cheaper_pct"] for s in setups]
    checks = {
        "headline_range_in_readme": [lo, hi],
        "range_from_table": [min(costs), max(costs)],
        "headline_matches_table": [lo, hi] == [min(costs), max(costs)],
        "setups_solving_more": sum(s["solved_change_points"] > 0 for s in setups),
        "average_cheaper_pct": round(sum(costs) / len(costs), 1),
    }
    results = {"source": "microsoft/TokenEconomizer README and docs/assets/results_overview.py "
                         "(the paper's Table 1, arXiv 2610.22732), 277 SWE-Bench tasks, 6 repos",
               "rule": "more work in the same budget = 1 / (1 - share saved) - 1",
               "checks": checks, "setups": setups}
    (HERE / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))

    print(f"{'setup':<28}{'cheaper':>9}{'more work':>11}{'solved':>14}")
    for s in setups:
        print(f"{s['setup']:<28}{s['cheaper_pct']:>8}%{s['more_work_same_budget_pct']:>10}%"
              f"{s['tasks_solved_before_pct']:>7}->{s['tasks_solved_after_pct']}")
    print("\nchecks:", json.dumps(checks))
    chart(setups)


def chart(setups):
    # Writes chart.json and draws chart.png with the repo's shared chart style (_style/render.js).
    best = max(setups, key=lambda s: s["more_work_same_budget_pct"])
    spec = {
        "test": "002",
        "type": "hbars",
        "title": "How much more AI coding fits in one budget?",
        "subtitle": "With Microsoft's free TokenEconomizer plugin, 277 coding tasks per setup",
        "suffix": "%", "prefix": "+", "decimals": 0,
        "data": [{"label": s["setup"], "value": s["more_work_same_budget_pct"],
                  **({"highlight": True} if s is best else {})}
                 for s in sorted(setups, key=lambda s: s["more_work_same_budget_pct"])],
        "note": {"text": f"{round(best['more_work_same_budget_pct'])}% more on Opus"},
        "source": "TokenEconomizer paper, Table 1 (arXiv 2610.22732), via its GitHub repo",
    }
    (HERE / "chart.json").write_text(json.dumps(spec, indent=2))
    render = HERE.parent / "_style" / "render.js"
    try:
        subprocess.run(["node", str(render), "chart.json", "chart.png"], cwd=HERE, check=True)
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"\ncouldn't draw chart.png ({e}). chart.json has the data; see _style/README.md")


if __name__ == "__main__":
    main()
