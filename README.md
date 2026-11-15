# ai-news-lab

Small tests on AI news, one folder per post. Each folder has the code, the data and the chart.

When something new comes out in AI, I build a quick test around it with an AI agent, run it, and post what the numbers say. The code is here so anyone can check the result or run it again.

## How a folder looks

```
2026-11-15-short-name/
  main.py        the test, runs with one command
  data/          the raw data the test used, with sources
  results.json   the final numbers
  chart.png      the chart from the post
  README.md      the question, the method, the result and the limits
```

## Run one

```
cd 2026-11-15-short-name
pip install -r requirements.txt   # when the folder has one
python main.py
```

## Tests

| Date | Test |
|------|------|
