import json
parts=[open(f).read() for f in ['_head.js','_engine.js','_helpers.js','_views.js','_pages.js','_main.js','_posts.js','_sponsor.js','_groups.js','_pro.js','_ads.js','_details.js','_design.js']]
open('public/app.js','w').write("(function(){\n"+"\n".join(parts)+"\n})();\n")
rows=json.load(open('players_src.json'))
out=[]
for r in rows:
    s=r['stats']
    out.append(dict(id=r['id'],name=r['name'],pos=r['pos'],team=r['team'],note=r['note'],sort=r['id'],active=r.get('active',True),goat=r.get('goat',False),career=r.get('career'),jersey=r.get('jersey'),
      games=s[0] if s else None,pts=s[1] if s else None,reb=s[2] if s else None,ast=s[3] if s else None,stl=s[4] if s else None,blk=s[5] if s else None))
json.dump(out,open('public/players.json','w'),separators=(',',':'))
