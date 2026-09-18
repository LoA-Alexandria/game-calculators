import json
import re
from pathlib import Path

wt = Path("wiki-anecdote.wikitext").read_text(encoding="utf-8")
parts = re.split(r'<div class="pe-anecdote__card', wt)[1:]
rows = []
for p in parts:
    m_id = re.search(r'id="(anecdote-\d+)"', p)
    m_name = re.search(r'pe-anecdote__name">(.*?)</div>', p)
    m_file = re.search(r"\[\[File:(Anecdote[^\|\]]+)", p)
    m_unlock = re.search(r"'''Unlock:'''\s*(.*?)\n", p)
    steps = re.findall(r"^#\s+(.*)$", p, re.M)
    rows.append(
        {
            "wikiId": m_id.group(1) if m_id else None,
            "name": m_name.group(1).strip() if m_name else None,
            "file": m_file.group(1).strip() if m_file else None,
            "unlock": m_unlock.group(1).strip() if m_unlock else None,
            "steps": steps,
        }
    )

Path("wiki-anecdotes-parsed.json").write_text(
    json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8"
)
print("total", len(rows))
for r in rows:
    print(f"{r['wikiId']}: {r['name']} | img={r['file']} | steps={len(r['steps'])}")
