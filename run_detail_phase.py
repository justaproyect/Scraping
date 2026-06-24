import json, os, time, concurrent.futures, threading

BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "datos")
API_KEY = "AIzaSyCxfBhccJevL5NDSL-mPYSTqvjA7gHVGDk"
LOCATION = "Barranquilla"

all_places = json.load(open(os.path.join(DATA_DIR, f"places_{LOCATION.lower()}.json"), "r", encoding="utf-8"))
items = list(all_places.items())
total = len(items)
negocios = [None] * total
done = [0]
lock = threading.Lock()
last_call = [0.0]

def get_detail(pid):
    import requests
    params = {
        "place_id": pid, "key": API_KEY, "language": "es",
        "fields": "name,formatted_phone_number,international_phone_number,formatted_address,website,rating,user_ratings_total,types",
    }
    try:
        resp = requests.get("https://maps.googleapis.com/maps/api/place/details/json", params=params, timeout=15)
        data = resp.json()
        if data.get("status") != "OK":
            return None
        r = data.get("result", {})
        phone = r.get("formatted_phone_number") or r.get("international_phone_number") or ""
        return {
            "nombre": r.get("name", ""),
            "telefono": phone,
            "direccion": r.get("formatted_address", ""),
            "sitio_web": r.get("website", ""),
            "rating": r.get("rating"),
            "votos": r.get("user_ratings_total", 0),
            "tipo": "",
        }
    except:
        return None

def procesar(i):
    pid, (name, btype) = items[i]
    with lock:
        elapsed = time.time() - last_call[0]
        if elapsed < 0.2:
            time.sleep(0.2 - elapsed)
        last_call[0] = time.time()
    detail = get_detail(pid)
    if detail:
        detail["tipo"] = btype
        return detail
    return {"nombre": name, "telefono": "", "direccion": "", "sitio_web": "", "rating": "", "votos": 0, "tipo": btype}

print(f"Obteniendo detalles de {total} places...")
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    futuros = {pool.submit(procesar, i): i for i in range(total)}
    for fut in concurrent.futures.as_completed(futuros):
        i = futuros[fut]
        negocios[i] = fut.result()
        done[0] += 1
        if done[0] % 50 == 0:
            print(f"  {done[0]}/{total}...")

con_telefono = [n for n in negocios if n.get("telefono")]
sin_telefono = [n for n in negocios if not n.get("telefono")]

print(f"\nTotal: {len(negocios)} | Con telefono: {len(con_telefono)} | Sin telefono: {len(sin_telefono)}")

path = os.path.join(DATA_DIR, f"negocios_{LOCATION.lower().replace(' ', '_')}.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(negocios, f, ensure_ascii=False, indent=2)
print(f"Guardado: {path}")
