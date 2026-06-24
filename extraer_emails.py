import json, re, requests, concurrent.futures, threading, time, os

BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "datos")
ENVIAR_PATH = os.path.join(DATA_DIR, "enviar_barranquilla.json")

data = json.load(open(ENVIAR_PATH, 'r', encoding='utf-8'))
EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
lock = threading.Lock()
last = [0.0]
done = [0]
total_attempted = [0]

def extract_email(n):
    url = n.get('sitio_web', '')
    if not url or not url.startswith('http') or 'wa.me' in url:
        return None
    with lock:
        total_attempted[0] += 1
        elapsed = time.time() - last[0]
        if elapsed < 0.4:
            time.sleep(0.4 - elapsed)
        last[0] = time.time()
    try:
        r = requests.get(url, timeout=8, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        if r.status_code == 200:
            emails = EMAIL_RE.findall(r.text)
            emails = [e for e in emails if not any(e.endswith(ext) for ext in ['.png','.jpg','.gif','.svg','.css','.js','.ico','.woff','.ttf','.eot'])]
            emails = list(set(emails))
            # Filter out no-reply, example, sentry, etc.
            emails = [e for e in emails if not any(x in e.lower() for x in ['example','sentry','no-reply','noreply','donotreply'])]
            if emails:
                return emails[0]
    except:
        pass
    return None

items = [n for n in data if n.get('sitio_web') and n.get('telefono') and n['sitio_web'].startswith('http') and 'wa.me' not in n['sitio_web']]
print(f'Attempting email extraction for {len(items)} businesses...')

found = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    fut_map = {pool.submit(extract_email, n): n for n in items}
    for f in concurrent.futures.as_completed(fut_map):
        n = fut_map[f]
        email = f.result()
        n['email'] = email or ''
        if email:
            found += 1
            if found <= 10 or found % 25 == 0:
                print(f'  [{found}] {n["nombre"][:40]:40s} -> {email}')

total_con_wa = len([n for n in data if n.get('telefono')])
total_con_email = len([n for n in data if n.get('email')])
print(f'\nResultados:')
print(f'  Total negocios: {len(data)}')
print(f'  Con telefono (WA): {total_con_wa}')
print(f'  Con email: {total_con_email}')
print(f'  Intentos: {total_attempted[0]}, Encontrados: {found}')

json.dump(data, open(ENVIAR_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'Guardado: {ENVIAR_PATH}')
