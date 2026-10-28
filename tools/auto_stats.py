"""Automatic stats refresh for F2R (runs from GitHub Actions, see .github/workflows/stats.yml).

1. Downloads this season's per-game table from Basketball-Reference (one request).
2. Updates every active player's stats in Supabase through the REST API.
3. Updates public/config.js (statsLabel) and players_src.json / public/players.json so the site and demo match.

Needs two environment variables (GitHub repo secrets): SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
Players the table doesn't list (no games yet, or a name mismatch) are left exactly as they are.
If the download looks wrong (too few rows), nothing is written and the run fails, so the app keeps the last good stats.
"""
import datetime, html, json, os, re, sys, unicodedata, urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = re.compile(r'out for the season', re.I)
# our name -> Basketball-Reference name, for players listed under a different first name
ALIAS = {'herb jones': 'herbert jones', 'cam johnson': 'cameron johnson', 'ron holland': 'ronald holland'}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def norm(n):
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r'[^a-z ]', '', n.replace('-', ' '))
    n = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', n)
    n = ' '.join(n.split())
    return ALIAS.get(n, n)


def season_end_year(today):
    return today.year + 1 if today.month >= 8 else today.year


def parse_per_game(page):
    """Return {normalized name: (games, pts, reb, ast, stl, blk)} from the per-game table.
    Traded players: the combined row (2TM/3TM) comes first, so the first row per name wins."""
    m = re.search(r'<table[^>]*id="per_game_stats".*?</table>', page, re.S)
    if not m:
        raise SystemExit('Per-game table not found on the page.')
    rows = {}
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(0), re.S):
        cells = {k: html.unescape(re.sub(r'<[^>]+>', '', v)).strip()
                 for k, v in re.findall(r'<t[dh][^>]*data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', tr, re.S)}
        name = cells.get('name_display') or cells.get('player')
        if not name or name in ('Player', 'League Average'):
            continue
        key = norm(name.replace('*', ''))
        if key in rows:
            continue

        def f(k):
            try:
                return round(float(cells.get(k + '_per_g', '')), 1)
            except ValueError:
                return None
        try:
            g = int(cells.get('games') or cells.get('g') or 0)
        except ValueError:
            g = 0
        rows[key] = (g, f('pts'), f('trb'), f('ast'), f('stl'), f('blk'))
    return rows


def http(url, method='GET', data=None, headers=None):
    req = urllib.request.Request(url, method=method, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8')


def main():
    sb_url = os.environ['SUPABASE_URL'].rstrip('/')
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    auth = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
    today = datetime.datetime.utcnow() - datetime.timedelta(hours=5)  # Eastern, close enough for a date label
    year = season_end_year(today)
    page = http(f'https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html',
                headers={'User-Agent': 'Mozilla/5.0 (F2R stats refresh; twice a week)'})
    stats = parse_per_game(page)
    if len(stats) < 150:
        raise SystemExit(f'Only {len(stats)} players found; the page may have changed. Nothing was written.')

    players = json.loads(http(f'{sb_url}/rest/v1/players?select=id,name,active,note&active=eq.true', headers=auth))
    updated, missing = 0, []
    for p in players:
        s = stats.get(norm(p['name']))
        if not s:
            missing.append(p['name'])
            continue
        body = dict(zip(('games', 'pts', 'reb', 'ast', 'stl', 'blk'), s))
        if not OUT.search(p.get('note') or ''):
            body['note'] = ''
        http(f"{sb_url}/rest/v1/players?id=eq.{p['id']}", 'PATCH', json.dumps(body).encode(),
             dict(auth, Prefer='return=minimal'))
        updated += 1

    through = today - datetime.timedelta(days=1)
    label = f"{year - 1}-{str(year)[2:]} season (through {MONTHS[through.month - 1]} {through.day})"

    # keep the site files in step: label in config.js, stats in the demo player list
    cfg = os.path.join(HERE, 'public', 'config.js')
    text = open(cfg).read()
    open(cfg, 'w').write(re.sub(r'statsLabel:\s*"[^"]*"', f'statsLabel: "{label}"', text, count=1))
    src = os.path.join(HERE, 'players_src.json')
    rows = json.load(open(src))
    for r in rows:
        s = stats.get(norm(r['name']))
        if s and r.get('active', True):
            r['stats'] = list(s)
            if not OUT.search(r.get('note') or ''):
                r['note'] = ''
    json.dump(rows, open(src, 'w'), indent=1, ensure_ascii=False)

    print(f'{label}: {updated} players updated in Supabase.')
    if missing:
        print('Not in the table (no games yet, or a name to fix): ' + ', '.join(missing))


if __name__ == '__main__':
    main()
