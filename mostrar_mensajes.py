import json

with open("datos/enviar_barranquilla.json", "r", encoding="utf-8") as f:
    data = json.load(f)

tipos = sorted(set(n["tipo"] for n in data if n.get("telefono")))
for t in tipos:
    n = next(x for x in data if x["tipo"] == t and x.get("telefono"))
    print(f"[{t}]")
    print(f"  {n['nombre'][:40]}")
    print(f"  Msj: {n['mensaje'][:120]}...")
    print()
