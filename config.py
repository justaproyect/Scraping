# Energy Company Scraper
# Busca empresas de sistemas energéticos / ahorro de energía
# y las guarda en Firebase Firestore

# --- FUENTES DE BÚSQUEDA (Google Places API) ---
# Términos para buscar en Google Places
SEARCH_TERMS = [
    "sistemas energeticos",
    "ahorro de energia",
    "paneles solares",
    "energia solar",
    "eficiencia energetica",
    "energias renovables",
    "instalacion paneles solares",
    "sistemas fotovoltaicos",
    "auditoria energetica",
    "consultoria energetica",
]

# Ciudades/regiones donde buscar (Colombia)
LOCATIONS = [
    "Barranquilla",
]

# --- CONFIGURACIÓN WEB SCRAPING ---
# Sitios de directorios empresariales para scrapear
DIRECTORIES = [
    "paginasamarillas.com.co",
    "directorio.empresas.com.co",
    "infoempresa.com.co",
    "colombiaempresas.com",
]

# --- CONFIGURACIÓN FIREBASE ---
# Ruta al archivo de credenciales Firebase (JSON)
# Descargar desde: Console Firebase -> Configuración -> Cuentas de servicio
FIREBASE_CREDENTIALS_PATH = "firebase-credentials.json"

# Nombre de la colección en Firestore
FIRESTORE_COLLECTION = "empresas_energeticas"

# --- CONFIGURACIÓN GOOGLE PLACES ---
# Obtener en: https://console.cloud.google.com/apis/credentials
GOOGLE_PLACES_API_KEY = "AIzaSyCxfBhccJevL5NDSL-mPYSTqvjA7gHVGDk"

# --- CONFIGURACIÓN GENERAL ---
# Retardo entre solicitudes (segundos) para evitar bloqueos
REQUEST_DELAY = 2

# Máximo de resultados por búsqueda en Places API
MAX_PLACES_RESULTS = 20

# Máximo de páginas a scrapear por directorio
MAX_DIRECTORY_PAGES = 5

# Exportar también a Excel local como respaldo
EXPORT_TO_EXCEL = True
EXCEL_OUTPUT_PATH = "empresas_energeticas.xlsx"
