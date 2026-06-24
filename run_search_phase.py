import sys, json, os, time
sys.path.insert(0, os.path.dirname(__file__))
import importlib
buscar = importlib.import_module("1_buscar")

location = "Barranquilla"
all_places = {}
total_q = sum(len(v) for v in buscar.BUSINESS_TYPES.values())
qi = 0
for btype, terms in buscar.BUSINESS_TYPES.items():
    for term in terms:
        qi += 1
        print(f"[{qi}/{total_q}] {btype}: {term}")
        results = buscar.text_search_paginated(term, location)
        for p in results:
            pid = p.get("place_id")
            if pid and pid not in all_places:
                all_places[pid] = (p.get("name", ""), btype)
        time.sleep(0.3)
print(f"Total: {len(all_places)}")
out = os.path.join(buscar.DATA_DIR, f"places_{location.lower()}.json")
json.dump(all_places, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"Saved: {out}")
