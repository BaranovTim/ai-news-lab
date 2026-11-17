# What this checks: OpenAI released GPT-6.2 Astra and Sol on nov 17 2026, and within hours
# X was full of "worst model OpenAI ever shipped". This script takes 220 English posts about
# the launch (pulled from X search, newest first, 18:58 to 20:36 UTC, at least 3 likes, no
# replies or reposts), each sorted by hand into one group with the rules below, and asks:
# what did the people who actually showed their own test say?
#
# Groups (one per post, first rule that fits wins):
#   tried_good  / tried_bad / tried_mixed  the author shows or describes their OWN run of the
#               model (a demo, a timing, a cost, a benchmark they ran, early-access use) and says
#               it went well / badly / both (or gives no verdict)
#   safety      about the system card, alignment or cyber testing
#   take_bad / take_good   a verdict on the model with no own test shown (incl. repeating
#               other people's reviews or someone else's benchmark as a complaint or praise)
#   news        launch info, prices, benchmark numbers without a verdict, "now available in X", ads
#   other       jokes, questions, "where is my access", meta posts about the drama
# Only the first ~200 characters of each post were read; data/posts.tsv keeps the start of each.
# Run: python main.py
import csv, json, re, subprocess
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
TRIED = ["tried_good", "tried_mixed", "tried_bad"]


def load():
    with open(HERE / "data" / "posts.tsv") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    for r in rows:
        r["likes"] = int(r["likes"])
    return rows


def keyword_check(rows):
    # A second, dumb way to find "showed their own test": first-person testing words.
    # Not used for the result, only to see how far a keyword rule agrees with the hand labels.
    pat = re.compile(r"\b(i (tested|ran|asked|used|made|built|gave|got to test|had early access|am testing|just tested)|"
                     r"my (own )?(test|demo|nyc test|side)|test #|one shot|one-shot|made this|built this|"
                     r"created this|did this|same prompt|initial thoughts)\b", re.I)
    hit = [bool(pat.search(r["text_start"])) for r in rows]
    hand = [r["label"] in TRIED for r in rows]
    agree = sum(h == k for h, k in zip(hand, hit))
    return {"posts": len(rows), "agree": agree, "agree_pct": round(100 * agree / len(rows), 1),
            "keyword_says_tried": sum(hit), "hand_says_tried": sum(hand)}


def main():
    rows = load()
    n = len(rows)
    count = Counter(r["label"] for r in rows)
    likes = Counter()
    for r in rows:
        likes[r["label"]] += r["likes"]
    tried = sum(count[k] for k in TRIED)
    verdict_no_test = count["take_bad"] + count["take_good"]
    res = {
        "source": "X search, query (\"GPT-6.2\" OR \"GPT 6.2\" OR \"6.2 Astra\" OR \"6.2 Sol\") lang:en "
                  "-filter:retweets -filter:replies min_faves:3, Latest, read nov 17 2026 20:36 UTC",
        "posts": n,
        "groups": {k: {"posts": count[k], "likes": likes[k]} for k in
                   ["tried_good", "tried_mixed", "tried_bad", "take_bad", "take_good", "safety", "news", "other"]},
        "showed_own_test": tried,
        "of_testers_liked_pct": round(100 * count["tried_good"] / tried, 1),
        "of_testers_disliked_pct": round(100 * count["tried_bad"] / tried, 1),
        "bad_verdict_without_test": count["take_bad"],
        "share_of_negative_verdicts_without_test_pct":
            round(100 * count["take_bad"] / (count["take_bad"] + count["tried_bad"]), 1),
        "likes_bad_no_test_vs_good_tested": [likes["take_bad"], likes["tried_good"]],
        "most_liked": sorted(({"user": r["user"], "likes": r["likes"], "label": r["label"],
                               "text_start": r["text_start"][:90]} for r in rows),
                             key=lambda r: -r["likes"])[:5],
        "keyword_check": keyword_check(rows),
    }
    # check the key number a second way: from the like-weighted totals and the raw rows
    assert sum(1 for r in rows if r["label"].startswith("tried_")) == tried
    assert sum(g["posts"] for g in res["groups"].values()) == n
    (HERE / "results.json").write_text(json.dumps(res, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in res.items() if k != "most_liked"}, indent=1))
    chart(count)


def chart(count):
    # Writes chart.json and draws chart.png with the repo's shared chart style (_style/render.js).
    tried = sum(count[k] for k in TRIED)
    spec = {
        "test": "003",
        "type": "hbars",
        "title": "Did the people who tried GPT-6.2 like it?",
        "subtitle": f"{sum(count.values())} English posts on X in the first hours after launch, nov 17 2026, sorted by hand",
        "data": [
            {"label": "Praised it, no test", "value": count["take_good"]},
            {"label": "Tested, disliked it", "value": count["tried_bad"]},
            {"label": "Tested, mixed", "value": count["tried_mixed"]},
            {"label": "Trashed it, no test", "value": count["take_bad"]},
            {"label": "Tested, liked it", "value": count["tried_good"], "highlight": True},
        ],
        "note": {"text": f"{round(100 * count['tried_good'] / tried)}% of testers liked it"},
        "source": "X search, 3+ likes, 18:58 to 20:36 UTC, news and jokes left out",
    }
    (HERE / "chart.json").write_text(json.dumps(spec, indent=2))
    render = HERE.parent / "_style" / "render.js"
    try:
        subprocess.run(["node", str(render), "chart.json", "chart.png"], cwd=HERE, check=True)
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"\ncouldn't draw chart.png ({e}). chart.json has the data; see _style/README.md")


if __name__ == "__main__":
    main()
