# Energy Company Scraper

Buscador masivo de empresas de **sistemas energéticos / ahorro de energía** en Colombia. Extrae datos desde Google Places, directorios web y sitios web, y los almacena en **Firebase Firestore**.

## Funcionalidades

- **Google Places API**: Busca empresas por término + ubicación en toda Colombia
- **Web scraping**: Extrae datos de directorios empresariales
- **Phone extractor**: Detecta números colombianos (+57) en múltiples formatos
- **Website enricher**: Navega los sitios web de las empresas para encontrar más datos
- **Firebase Firestore**: Almacenamiento en la nube sin duplicados
- **Excel backup**: Exporta respaldo local en formato .xlsx

## Requisitos

- Python 3.8+
- Cuenta de Google Cloud (para Places API)
- Cuenta de Firebase (opcional, para base de datos)
- Las siguientes dependencias:

```bash
pip install requests beautifulsoup4 firebase-admin openpyxl
```

## Configuración

### 1. Google Places API
1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Crea un proyecto y habilita **Places API**
3. Genera una **API Key**
4. Edita `config.py` y pega la llave:

```python
GOOGLE_PLACES_API_KEY = "TU_API_KEY_AQUI"
```

### 2. Firebase (opcional)
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un proyecto o usa uno existente
3. Configuración del proyecto → **Cuentas de servicio**
4. **Generar nueva clave privada** → descarga el JSON
5. Guarda el archivo como `firebase-credentials.json` en la carpeta del proyecto

### 3. Personalizar búsqueda
Edita `config.py` para cambiar:
- `SEARCH_TERMS`: Términos de búsqueda
- `LOCATIONS`: Ciudades/regiones
- `MAX_PLACES_RESULTS`: Resultados máximos por búsqueda

## Uso

```bash
cd energy_scraper
python main.py
```

El programa:
1. Busca en Google Places (todas las combinaciones término × ubicación)
2. Busca en directorios web
3. Elimina duplicados
4. Enriquece datos desde sitios web
5. Guarda en Firebase Firestore
6. Exporta a Excel

## Estructura del proyecto

```
energy_scraper/
├── config.py                 # Configuración (términos, API keys, etc.)
├── google_places_scraper.py  # Búsqueda en Google Places API
├── web_scraper.py            # Scraping de directorios y sitios web
├── phone_extractor.py        # Extracción de números de teléfono
├── firebase_db.py            # Integración con Firebase Firestore
├── main.py                   # Orquestador principal
├── requirements.txt          # Dependencias
└── README.md                 # Este archivo
```

## Disclaimer

Este programa está diseñado para **recopilar información de contacto pública** de empresas. Asegúrate de cumplir con los términos de servicio de las plataformas utilizadas y las leyes de protección de datos aplicables en Colombia (Ley 1581 de 2012).
