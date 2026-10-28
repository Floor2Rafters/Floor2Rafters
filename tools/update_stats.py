"""Turn a Basketball-Reference per-game table into SQL that updates F2R's player stats.

How to use (about 5 minutes, every Monday morning once the switch happens):
  1. Open basketball-reference.com/leagues/NBA_2027_per_game.html (the 2026-27 season page).
  2. Above the table: Share & Export -> Get table as CSV. Copy it into a file, e.g. per_game.csv.
  3. Run:  python3 tools/update_stats.py per_game.csv "2026-27 season (through Nov 9)"
  4. Paste the printed SQL into Supabase -> SQL Editor -> Run.
  5. Put the same label in public/config.js (statsLabel) so the app says which stats it shows.

Players are matched by name (accents and Jr./III ignored). Anyone the script can't match is listed at the end
so you can fix the name in Supabase -> Table Editor -> players. Traded players use their combined row (2TM/3TM).
"""
import csv, json, os, re, sys, unicodedata

def norm(n):
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r'[^a-z ]', '', n.replace('-', ' '))
    n = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', n)
    return ' '.join(n.split())

def main(csv_path, label):
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    players = json.load(open(os.path.join(here, 'players_src.json')))
    rows = {}
    with open(csv_path, newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            name = (r.get('Player') or '').replace('*', '').strip()
            if not name or name == 'Player' or name == 'League Average':
                continue
            key = norm(name)
            team = r.get('Team') or r.get('Tm') or ''
            # traded players: Basketball-Reference lists the combined row (2TM/3TM) first, so keep the first row
            if key in rows:
                continue
            rows[key] = {'combined': bool(re.match(r'\dTM|TOT', team)), 'g': r.get('G'), 'pts': r.get('PTS'),
                         'reb': r.get('TRB'), 'ast': r.get('AST'), 'stl': r.get('STL'), 'blk': r.get('BLK')}
    out, missing = [], []
    for p in players:
        if not p.get('active', True):
            continue
        s = rows.get(norm(p['name']))
        if not s:
            missing.append(p['name'])
            continue
        def num(x):
            try: return str(round(float(x), 1))
            except (TypeError, ValueError): return 'null'
        # keep an "Out for the season" note (it drives the OUT tag); any other note is cleared once a player has stats
        note = "note" if OUT.match(p.get('note') or '') else "''"
        out.append(f"update public.players set games={int(float(s['g'] or 0))},pts={num(s['pts'])},reb={num(s['reb'])},ast={num(s['ast'])},"
                   f"stl={num(s['stl'])},blk={num(s['blk'])},note={note} where id={p['id']};")
        p['stats'] = [int(float(s['g'] or 0))] + [float(num(s[k])) if num(s[k]) != 'null' else None for k in ('pts', 'reb', 'ast', 'stl', 'blk')]
        if note == "''": p['note'] = ''
    # Active players with no games yet this season: clear last season's numbers so they never show under this season's label.
    blank = [p for p in players if p.get('active', True) and p['name'] in missing]
    for p in blank:
        keep = OUT.match(p.get('note') or '')
        out.append(f"update public.players set games=null,pts=null,reb=null,ast=null,stl=null,blk=null"
                   f"{'' if keep else ', note=' + chr(39) + NO_GAMES + chr(39)} where id={p['id']};")
        p['stats'] = None
        if not keep: p['note'] = NO_GAMES
    if '--demo' in sys.argv:
        json.dump(players, open(os.path.join(here, 'players_src.json'), 'w'), indent=1, ensure_ascii=False)
    print('-- F2R stats update: ' + label)
    print('begin;')
    print('\n'.join(out))
    print('commit;')
    print(f'-- {len(out) - len(blank)} players updated with stats.')
    if missing:
        print(f'-- No games yet this season (shown as "{NO_GAMES}"): check any name here that should have games:')
        print('-- ' + ', '.join(missing))

OUT = re.compile(r'out for the season', re.I)
NO_GAMES = 'No games yet this season'

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    main(sys.argv[1], sys.argv[2])
