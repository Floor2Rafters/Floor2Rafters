"""Adds jersey numbers to the players.
Usage: python3 tools/add_jerseys.py jerseys.json
jerseys.json: {"numbers": {"<player id>": "23", ...}}  (from ESPN team roster pages)
Updates players_src.json (for the demo) and prints SQL to paste into Supabase → SQL Editor."""
import json, sys
nums = json.load(open(sys.argv[1]))["numbers"]
rows = json.load(open("players_src.json"))
byid = {r["id"]: r for r in rows}
sql = []
for k, v in nums.items():
    r = byid.get(int(k))
    if not r: continue
    v = str(v).strip()
    if not v.isdigit() or len(v) > 2: continue
    r["jersey"] = v
    sql.append(f"update public.players set jersey = '{v}' where id = {int(k)};")
json.dump(rows, open("players_src.json", "w"), indent=1, ensure_ascii=False)
print("\n".join(sql))
print(f"-- {len(sql)} jersey numbers", file=sys.stderr)
