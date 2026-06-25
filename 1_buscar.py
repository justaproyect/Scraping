import requests, time, json, os
from datetime import datetime

API_KEY = "AIzaSyCxfBhccJevL5NDSL-mPYSTqvjA7gHVGDk"
DATA_DIR = os.path.join(os.path.dirname(__file__), "datos")
os.makedirs(DATA_DIR, exist_ok=True)

BUSINESS_TYPES = {
    "hoteles": ["hoteles", "hospedajes", "lodges", "hostales"],
    "centros comerciales": ["centros comerciales", "plazas comerciales", "centros comerciales grandes"],
    "restaurantes": ["restaurantes", "restaurantes formales", "comedores ejecutivos", "restaurantes de lujo"],
    "clinicas": ["clinicas", "ips", "centros de salud", "centros medicos"],
    "hospitales": ["hospitales", "centros hospitalarios"],
    "colegios": ["colegios", "instituciones educativas", "liceos", "centros educativos privados"],
    "universidades": ["universidades", "institutos tecnicos", "centros de formacion"],
    "grandes empresas": ["empresas grandes", "corporaciones", "grupos empresariales", "oficinas principales"],
    "gimnasios": ["gimnasios", "centros de fitness", "spa y gimnasios", "clubes deportivos"],
    "bancos": ["bancos", "entidades financieras", "corporaciones financieras", "cooperativas financieras"],
    "supermercados": ["supermercados", "hipermercados", "tiendas de cadena", "almacenes de cadena"],
    "concesionarios": ["concesionarios", "automoviles", "autos usados", "concesionarios de motos"],
    "industrias": ["industrias", "plantas de produccion", "empresas industriales", "fabricas manufactureras"],
    "fabricas": ["fabricas", "plantas industriales", "talleres industriales", "procesadoras"],
    "bodegas industriales": ["bodegas industriales", "centros logisticos", "parques industriales", "zonas francas"],
    "edificios de oficinas": ["edificios de oficinas", "torres empresariales", "centros de negocios", "coworking"],
    "moteles": ["moteles", "hoteles de paso"],
    "almacenes grandes": ["almacenes grandes", "grandes superficies", "mayoristas", "distribuidoras"],
    "plazoletas de comidas": ["plazoletas de comidas", "patios de comidas", "food courts", "zonas de comidas"],
    "consultorios": ["consultorios medicos", "consultorios odontologicos", "centros de especialistas"],
    "inmobiliarias": ["inmobiliarias", "agencias inmobiliarias", "constructoras", "urbanizaciones"],
    "talleres": ["talleres mecanicos", "talleres automotrices", "lubricentros", "centros de servicio"],
    "salones de belleza": ["salones de belleza", "peluquerias", "centros de estetica", "barberias"],
    "laboratorios": ["laboratorios clinicos", "laboratorios dentales", "laboratorios de analisis"],
    "centros de rehabilitacion": ["centros de rehabilitacion", "terapias fisicas", "clinicas de rehabilitacion"],
    "veterinarias": ["veterinarias", "clinicas veterinarias", "centros veterinarios", "tiendas de mascotas"],
    "farmacias": ["farmacias", "droguerias", "tiendas naturistas", "homeopaticas"],
    "ferreterias": ["ferreterias", "materiales de construccion", "almacenes de construccion", "cerrajerias"],
    "panaderias": ["panaderias", "pastelerias", "reposterias", "heladerias"],
    "tiendas de ropa": ["tiendas de ropa", "boutiques", "almacenes de ropa", "ropa deportiva"],
    "opticas": ["opticas", "centros opticos", "laboratorios opticos"],
    "lavanderias": ["lavanderias", "tintorerias", "lavasecos"],
    "cafeterias": ["cafeterias", "cafes", "tiendas de cafe", "casas de te"],
    "bares": ["bares", "discotecas", "tabernas", "cantinas"],
    "parqueaderos": ["parqueaderos", "garajes", "estacionamientos"],
    "zapaterias": ["zapaterias", "tiendas de zapatos", "calzado"],
    "papelerias": ["papelerias", "librerias", "articulos de oficina", "copias"],
    "funerarias": ["funerarias", "servicios funerarios", "cementerios", "crematorios"],
    "floristerias": ["floristerias", "florerias", "venta de flores"],
    "cines": ["cines", "teatros", "multiplex", "salas de cine"],
    "mueblerias": ["mueblerias", "tiendas de muebles", "colchoneria", "decoracion"],
    "electrodomesticos": ["electrodomesticos", "tiendas de tecnologia", "electronica", "celulares"],
    "centros culturales": ["centros culturales", "museos", "bibliotecas", "galerias de arte"],
    "talleres bicicletas": ["talleres de bicicletas", "bicicleterias", "venta de bicicletas"],
    "carnicerias": ["carnicerias", "venta de carnes", "pescaderias", "avicolas"],
    "escuelas de conduccion": ["escuelas de conduccion", "autoescuelas", "academias de conduccion"],
    "centros de estetica": ["centros de estetica", "spas", "centros de masajes", "tratamientos corporales"],
    "tiendas de barrio": ["tiendas de barrio", "minimercados", "graneros", "venta de abarrotes"],
}

def text_search_paginated(term, location, max_pages=3):
    """Text Search with pagination, returns all unique results up to max_pages."""
    all_results = []
    params = {
        "query": f"{term} en {location}",
        "key": API_KEY,
        "language": "es",
        "type": "establishment",
    }
    for page in range(max_pages):
        try:
            resp = requests.get("https://maps.googleapis.com/maps/api/place/textsearch/json", params=params, timeout=15)
            data = resp.json()
            if data.get("status") != "OK":
                break
            results = data.get("results", [])
            all_results.extend(results)
            next_token = data.get("next_page_token")
            if not next_token:
                break
            params["pagetoken"] = next_token
            time.sleep(2.5)
        except Exception as e:
            print(f"    Error en pagina {page+1}: {e}")
            break
    return all_results

def get_detail(place_id):
    params = {
        "place_id": place_id, "key": API_KEY, "language": "es",
        "fields": "name,formatted_phone_number,international_phone_number,formatted_address,website,rating,user_ratings_total,types",
    }
    try:
        resp = requests.get("https://maps.googleapis.com/maps/api/place/details/json", params=params, timeout=10)
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

LOCATIONS = ["Barranquilla"]

def buscar(locations=None):
    if locations is None:
        locations = LOCATIONS
    all_places = {}
    for location in locations:
        print(f"\n{'='*60}\nBUSCANDO EN: {location.upper()}\n{'='*60}")
        total_queries = sum(len(terms) for terms in BUSINESS_TYPES.values())
        query_num = 0
        tipos = list(BUSINESS_TYPES.keys())
        for btype in tipos:
            terms = BUSINESS_TYPES[btype]
            for term in terms:
                query_num += 1
                print(f"[{query_num}/{total_queries}] {btype}: buscando '{term}'...")
                results = text_search_paginated(term, location)
                for place in results:
                    pid = place.get("place_id")
                    if pid and pid not in all_places:
                        all_places[pid] = (place.get("name", ""), btype)
                time.sleep(0.3)
            count = len([p for p in all_places.values() if p[1]==btype])
            print(f"  -> {btype}: {count} unicos hasta ahora")
        print(f"\n  Subtotal {location}: {len(all_places)} places unicos acumulados")
    print(f"\n{'='*60}")
    print(f"TOTAL places unicos (todas las ubicaciones): {len(all_places)}")
    import concurrent.futures, threading
    items = list(all_places.items())
    total = len(items)
    negocios = [None] * total
    done = [0]
    rate_lock = threading.Lock()
    last_call = [0.0]
    def procesar(i):
        pid, (name, btype) = items[i]
        with rate_lock:
            elapsed = time.time() - last_call[0]
            if elapsed < 0.25:
                time.sleep(0.25 - elapsed)
            last_call[0] = time.time()
        detail = get_detail(pid)
        if detail:
            detail["tipo"] = btype
            return detail
        return {"nombre": name, "telefono": "", "direccion": "", "sitio_web": "", "rating": "", "votos": 0, "tipo": btype}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futuros = {pool.submit(procesar, i): i for i in range(total)}
        for fut in concurrent.futures.as_completed(futuros):
            i = futuros[fut]
            negocios[i] = fut.result()
            done[0] += 1
            if done[0] % 50 == 0:
                print(f"  Detalle {done[0]}/{total}...")
    con_telefono = [n for n in negocios if n.get("telefono")]
    sin_telefono = [n for n in negocios if not n.get("telefono")]
    print(f"\nTotal: {len(negocios)} | Con telefono: {len(con_telefono)} | Sin telefono: {len(sin_telefono)}")
    out_name = "negocios_barranquilla"
    path = os.path.join(DATA_DIR, f"{out_name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(negocios, f, ensure_ascii=False, indent=2)
    print(f"Guardado: {path}")
    txt_path = os.path.join(DATA_DIR, f"{out_name}.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        for n in sorted(negocios, key=lambda x: x.get("tipo", "")):
            f.write(f"[{n.get('tipo',''):30s}] {n.get('nombre',''):50s} | {n.get('telefono',''):20s}\n")
    print(f"Guardado: {txt_path}")
    return negocios

if __name__ == "__main__":
    import sys
    locs = sys.argv[1:] if len(sys.argv) > 1 else None
    buscar(locs)
