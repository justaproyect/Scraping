import json, os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "datos")
CONFIG_PATH = os.path.join(DATA_DIR, "config.json")

SERVICIOS = [
    "Instalaciones Electricas",
    "Aire Acondicionado / Climatizacion",
    "Energia Solar (ON GRID)",
    "Energia Solar (HYBRID)",
    "Energia Solar (OFF GRID)",
    "CCTV / Seguridad Electronica",
    "Control de Acceso",
    "Infraestructura Tecnologica (Racks, UPS, Servidores)",
    "Conectividad / Starlink",
    "Asesoria SST",
]

def cargar_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "version": 1,
        "producto": "mantenimiento de aires acondicionados",
        "servicios_clave": [
            "Aire Acondicionado / Climatizacion",
            "Instalaciones Electricas",
            "CCTV / Seguridad Electronica",
            "Control de Acceso",
            "Infraestructura Tecnologica (Racks, UPS, Servidores)",
            "Energia Solar",
            "Asesoria SST"
        ],
        "propuesta_valor": "servicio rapido, profesional y con respuesta prioritaria",
        "ubicacion": "Barranquilla",
        "diferenciador": "planes de mantenimiento preventivo con cobertura en toda la ciudad"
    }

def analizar(negocios):
    config = cargar_config()
    for n in negocios:
        tipo = n.get("tipo", "").lower()
        nombre = n.get("nombre", "").lower()
        recomendados = set()
        svc = config.get("servicios_clave", [])
        ac = "Aire Acondicionado / Climatizacion"
        elec = "Instalaciones Electricas"
        cctv = "CCTV / Seguridad Electronica"
        ups = "Infraestructura Tecnologica (Racks, UPS, Servidores)"
        sst = "Asesoria SST"
        if any(p in tipo for p in ["hotel", "motel", "restaurante", "centro comercial", "supermercado"]):
            recomendados.add(ac)
            recomendados.add(elec)
            recomendados.add(cctv)
            if "hotel" in tipo or "motel" in tipo:
                recomendados.add("Control de Acceso")
                recomendados.add(ups)
            if "centro comercial" in tipo or "supermercado" in tipo:
                recomendados.add("Energia Solar (ON GRID)")
        if any(p in tipo for p in ["clinica", "hospital", "colegio", "universidad", "asilo"]):
            recomendados.add(elec)
            recomendados.add(ac)
            recomendados.add(cctv)
            recomendados.add(sst)
            recomendados.add(ups)
        if "clinica" in tipo or "hospital" in tipo:
            recomendados.add("Energia Solar (HYBRID)")
        if any(p in tipo for p in ["industria", "fabrica", "bodega"]):
            recomendados.add(elec)
            recomendados.add(sst)
            recomendados.add(cctv)
            recomendados.add("Energia Solar (ON GRID)")
            recomendados.add(ups)
        if any(p in tipo for p in ["banco", "oficina", "empresarial", "grandes empresas"]):
            recomendados.add(elec)
            recomendados.add(ac)
            recomendados.add(cctv)
            recomendados.add("Control de Acceso")
            recomendados.add(ups)
        if "gimnasio" in tipo:
            recomendados.add(ac)
            recomendados.add(cctv)
            recomendados.add(elec)
        if "concesionario" in tipo:
            recomendados.add(cctv)
            recomendados.add(elec)
            recomendados.add(ac)
            recomendados.add("Energia Solar (ON GRID)")
        if "almacen" in tipo:
            recomendados.add(cctv)
            recomendados.add(elec)
            recomendados.add(ac)
            recomendados.add("Control de Acceso")
        if "plazoleta" in tipo or "comidas" in tipo:
            recomendados.add(ac)
            recomendados.add(elec)
        if "consultorio" in tipo:
            recomendados.add(ac)
            recomendados.add(elec)
            recomendados.add(cctv)
        if "inmobiliaria" in tipo or "constructora" in tipo:
            recomendados.add(ac)
            recomendados.add(elec)
            recomendados.add(cctv)
        if "taller" in tipo:
            recomendados.add(elec)
            recomendados.add(cctv)
            recomendados.add(ac)
        if any(p in tipo for p in ["salon", "belleza", "peluqueria", "barberia", "estetica"]):
            recomendados.add(ac)
            recomendados.add(elec)
            recomendados.add(cctv)
        if any(p in tipo for p in ["laboratorio", "rehabilitacion"]):
            recomendados.add(ac)
            recomendados.add(elec)
            recomendados.add(cctv)
            recomendados.add(ups)
        if "asilo" in tipo:
            recomendados.add(ac)
            recomendados.add(elec)
            recomendados.add(cctv)
            recomendados.add(sst)
        n["servicios_recomendados"] = sorted(recomendados)
        n["mensaje"] = ""
    return negocios

def generar_mensaje(n):
    config = cargar_config()
    nombre = n.get("nombre", "").split(" - ")[0].split("|")[0].split("/")[0].strip()[:40]
    tipo = n.get("tipo", "").lower()
    producto = config.get("producto", "mantenimiento de aires acondicionados")
    ubicacion = config.get("ubicacion", "Barranquilla")
    propuesta = config.get("propuesta_valor", "servicio rapido y profesional")
    diferenciador = config.get("diferenciador", "planes de mantenimiento preventivo")
    servicios = n.get("servicios_recomendados", [])
    svc_str = ", ".join(servicios[:2]) if servicios else producto

    # Ver si el producto principal (AC) esta en los recomendados
    tiene_ac = any("aire" in s.lower() or "climat" in s.lower() for s in servicios)

    if "hotel" in tipo or "motel" in tipo:
        if tiene_ac:
            return (f"Hola, vi lo de {nombre}. Te escribo porque trabajamos con hoteles en {ubicacion}"
                    f" ofreciendo {producto}. Sabemos que para un hotel los aires son prioridad."
                    f" {diferenciador}. ¿Tienen convenio con alguien actualmente o podria cotizarles?")
        else:
            return (f"Hola, vi lo de {nombre}. Trabajamos con hoteles en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. {diferenciador}. ¿Les interesa una propuesta?")

    if "centro comercial" in tipo:
        if tiene_ac:
            return (f"Hola, vi lo de {nombre}. Somos especialistas en climatizacion para centros"
                    f" comerciales en {ubicacion} — {producto} de sistemas centrales, cassettes"
                    f" y piso techo. {diferenciador}. ¿Conversamos?")
        else:
            return (f"Hola, vi lo de {nombre}. Trabajamos con centros comerciales en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les interesa una cotizacion?")

    if "restaurante" in tipo:
        if tiene_ac:
            return (f"Hola, vi lo de {nombre}. En los restaurantes es clave tener los aires"
                    f" funcionando bien. Ofrecemos {producto} para splits, cassettes y sistemas"
                    f" centrales en {ubicacion}. {diferenciador}. ¿Les sirve una cotizacion?")
        else:
            return (f"Hola, vi lo de {nombre}. Trabajamos con restaurantes en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Que tal si conversamos?")

    if "clinica" in tipo or "hospital" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Trabajamos con clinicas en {ubicacion} dandoles"
                    f" {producto}. Sabemos que los aires no pueden fallar en areas criticas."
                    f" {diferenciador} con respuesta prioritaria. ¿Les gustaria recibir informacion?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con centros de salud en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les interesa una cotizacion?")

    if "colegio" in tipo or "universidad" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Les escribo porque trabajamos con colegios en {ubicacion}"
                    f" en {producto} para aulas y oficinas. {diferenciador} para toda la"
                    f" temporada escolar. ¿Estarian interesados en una revision gratuita?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con instituciones educativas en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les sirve una propuesta?")

    if "gimnasio" in tipo:
        if tiene_ac:
            return (f"Hola, vi lo de {nombre}. En los gimnasios los aires trabajan al maximo."
                    f" Ofrecemos {producto} de equipos split, cassette y piso techo en {ubicacion}."
                    f" {diferenciador}. ¿Les sirve una cotizacion?")
        else:
            return (f"Hola, vi lo de {nombre}. Trabajamos con gimnasios en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les interesa?")

    if "banco" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Trabajamos con sedes bancarias en {ubicacion} dandoles"
                    f" {producto} y respaldo electrico (UPS). {diferenciador}."
                    f" ¿Conversamos?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con entidades financieras en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les interesa una cotizacion?")

    if "supermercado" in tipo:
        if tiene_ac:
            return (f"Hola, vi lo de {nombre}. Somos especialistas en climatizacion para"
                    f" supermercados en {ubicacion} — {producto} de sistemas centrales"
                    f" y areas de ventas. {diferenciador}. ¿Estarian interesados en una propuesta?")
        else:
            return (f"Hola, vi lo de {nombre}. Trabajamos con supermercados en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les interesa?")

    if "concesionario" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Trabajamos con concesionarios en {ubicacion} en"
                    f" {producto} para sala de ventas, taller y oficinas. Tambien hacemos"
                    f" instalacion de CCTV. {diferenciador}. ¿Les interesa que les cotice?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con concesionarios en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les sirve?")

    if any(p in tipo for p in ["industria", "fabrica"]):
        if tiene_ac:
            return (f"Hola, vi {nombre}. Trabajamos con industrias en {ubicacion} ofreciendo"
                    f" {producto} para areas de produccion y oficinas. Tambien hacemos"
                    f" instalaciones electricas industriales y asesoria SST. {diferenciador}."
                    f" ¿Les sirve una propuesta?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con industrias en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Que tal si conversamos?")

    if "bodega" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Ofrecemos {producto} para bodegas y centros"
                    f" logisticos en {ubicacion}. Tambien hacemos instalaciones electricas"
                    f" y CCTV. {diferenciador}. ¿Les interesarfa recibir info?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con bodegas en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les sirve?")

    if "oficina" in tipo or "edificio" in tipo:
        if tiene_ac:
            return (f"Hola, vi lo de {nombre}. Trabajamos con edificios de oficinas en"
                    f" {ubicacion} en {producto} centrales y splits. Tambien ofrecemos"
                    f" instalaciones electricas y UPS. {diferenciador}. ¿Tienen equipos"
                    f" sin mantenimiento? Podemos cotizarles.")
        else:
            return (f"Hola, vi lo de {nombre}. Trabajamos con edificios de oficinas en"
                    f" {ubicacion} ofreciendo {svc_str}. {propuesta}. ¿Conversamos?")

    if "almacen" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Ofrecemos {producto} para almacenes y grandes"
                    f" superficies en {ubicacion}. Tambien hacemos instalacion de CCTV"
                    f" y control de acceso. {diferenciador}. ¿Les interesa una propuesta?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con almacenes en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les sirve?")

    if "asilo" in tipo:
        if tiene_ac:
            return (f"Hola, vi {nombre}. Trabajamos con centros de atencion para adultos"
                    f" mayores en {ubicacion} dandoles {producto}. El confort de los"
                    f" residentes es clave. {diferenciador} con respuesta prioritaria."
                    f" ¿Les interesa una cotizacion sin compromiso?")
        else:
            return (f"Hola, vi {nombre}. Trabajamos con centros de atencion en {ubicacion}"
                    f" ofreciendo {svc_str}. {propuesta}. ¿Les interesa una propuesta?")

    if "consultorio" in tipo:
        return (f"Hola, vi {nombre}. Trabajamos con consultorios en {ubicacion}"
                f" ofreciendo {svc_str}. {propuesta}. {diferenciador}."
                f" ¿Les interesa una cotizacion?")

    if "inmobiliaria" in tipo or "constructora" in tipo:
        return (f"Hola, vi {nombre}. Trabajamos con inmobiliarias en {ubicacion}"
                f" ofreciendo {svc_str}. {propuesta}. {diferenciador}."
                f" ¿Conversamos?")

    if "taller" in tipo:
        return (f"Hola, vi {nombre}. Trabajamos con talleres en {ubicacion}"
                f" ofreciendo {svc_str}. {propuesta}. {diferenciador}."
                f" ¿Les sirve una cotizacion?")

    if any(p in tipo for p in ["salon", "belleza", "peluqueria", "barberia", "estetica"]):
        return (f"Hola, vi {nombre}. Trabajamos con salones de belleza en {ubicacion}"
                f" ofreciendo {svc_str}. {propuesta}. {diferenciador}."
                f" ¿Estarian interesados en una revision?")

    if "laboratorio" in tipo:
        return (f"Hola, vi {nombre}. Trabajamos con laboratorios en {ubicacion}"
                f" ofreciendo {svc_str}. Sabemos que la temperatura y calidad de energia"
                f" son criticas. {propuesta}. ¿Les interesa una propuesta?")

    if "rehabilitacion" in tipo:
        return (f"Hola, vi {nombre}. Trabajamos con centros de rehabilitacion en {ubicacion}"
                f" ofreciendo {svc_str}. {propuesta}. {diferenciador}."
                f" ¿Les sirve una cotizacion?")

    if "plazoleta" in tipo or "comidas" in tipo:
        return (f"Hola, vi lo de {nombre}. Trabajamos con plazoletas de comidas en {ubicacion}"
                f" ofreciendo {svc_str}. {propuesta}. {diferenciador}."
                f" ¿Estarian interesados en una revision?")

    # Fallback generico
    return (f"Hola, vi {nombre}. Trabajamos en {ubicacion} ofreciendo {svc_str}."
            f" {propuesta}. {diferenciador}. ¿Les sirve una cotizacion sin compromiso?")

def mostrar_negocios(negocios):
    from collections import Counter
    tipos = Counter(n.get("tipo", "sin tipo") for n in negocios)
    print("\n" + "="*70)
    print("CLIENTES ENCONTRADOS - POR TIPO")
    print("="*70)
    for t, count in sorted(tipos.items()):
        print(f"  {t:35s} {count}")
    print(f"\nTotal: {len(negocios)}")
    con_tel = [n for n in negocios if n.get("telefono")]
    sin_tel = [n for n in negocios if not n.get("telefono")]
    print(f"Con telefono: {len(con_tel)} | Sin telefono: {len(sin_tel)}")

def guardar(negocios, location):
    path = os.path.join(DATA_DIR, f"enviar_{location.lower().replace(' ', '_')}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(negocios, f, ensure_ascii=False, indent=2)
    print(f"Guardado: {path}")
    return path

if __name__ == "__main__":
    import sys
    location = sys.argv[1] if len(sys.argv) > 1 else "Barranquilla"
    path = os.path.join(DATA_DIR, f"negocios_{location.lower().replace(' ', '_')}.json")
    if not os.path.exists(path):
        print(f"Ejecuta primero: python 1_buscar.py {location}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        negocios = json.load(f)

    # Merge asilos if available
    asilos_path = os.path.join(DATA_DIR, "asilos_barranquilla.json")
    if os.path.exists(asilos_path):
        with open(asilos_path, "r", encoding="utf-8") as f:
            asilos = json.load(f)
        existing_ids = set()
        for n in negocios:
            existing_ids.add(n.get("nombre", "").lower().strip())
        nuevos = 0
        for a in asilos:
            if a.get("nombre", "").lower().strip() not in existing_ids:
                a["tipo"] = "asilos"
                negocios.append(a)
                nuevos += 1
        print(f"Asilos fusionados: {nuevos} nuevos")

    negocios = analizar(negocios)
    for n in negocios:
        n["mensaje"] = generar_mensaje(n)
    mostrar_negocios(negocios)
    guardar(negocios, location)
