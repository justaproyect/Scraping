"""
Módulo de búsqueda en Google Places API
Busca empresas por término y ubicación, extrae nombre, teléfono, dirección, web
"""

import requests
import time
from typing import List, Dict, Optional
import config


class GooglePlacesScraper:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or config.GOOGLE_PLACES_API_KEY

    def search_businesses(self, term: str, location: str) -> List[Dict]:
        """Busca empresas por término + ubicación usando Places API."""
        if self.api_key == "TU_API_KEY_AQUI":
            print("[!] GOOGLE_PLACES_API_KEY no configurada en config.py")
            print("    Ve a https://console.cloud.google.com/apis/credentials")
            print("    Crea una API Key y pégala en config.py")
            return []

        results = []
        params = {
            "query": f"{term} en {location}",
            "key": self.api_key,
            "language": "es",
            "type": "establishment",
        }

        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

        while len(results) < config.MAX_PLACES_RESULTS:
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code != 200:
                print(f"  Error HTTP {resp.status_code}")
                break

            data = resp.json()
            if data.get("status") != "OK":
                if data.get("status") == "ZERO_RESULTS":
                    print("  Sin resultados")
                else:
                    print(f"  API error: {data.get('status')} - {data.get('error_message', '')}")
                break

            for place in data.get("results", []):
                # Obtener detalle para tener telefono y sitio web
                detail = self._get_place_detail(place.get("place_id", ""))
                if detail:
                    results.append(detail)
                else:
                    results.append({
                        "nombre": place.get("name", ""),
                        "telefono": "",
                        "telefono_internacional": "",
                        "direccion": place.get("formatted_address", ""),
                        "sitio_web": "",
                        "calificacion": place.get("rating"),
                        "total_resenas": place.get("user_ratings_total"),
                        "categorias": ", ".join(place.get("types", [])),
                        "termino_busqueda": "",
                        "ubicacion": "",
                        "fuente": "Google Places",
                    })
                time.sleep(0.3)  # Pausa entre detalles

                if len(results) >= config.MAX_PLACES_RESULTS:
                    break

            # Paginar
            next_token = data.get("next_page_token")
            if not next_token:
                break

            params["pagetoken"] = next_token
            time.sleep(2)  # Places API requiere pausa entre páginas

            if len(results) >= config.MAX_PLACES_RESULTS:
                break

        print(f"  -> {len(results)} empresas encontradas para '{term}' en '{location}'")
        return results

    def _get_place_detail(self, place_id: str) -> Optional[Dict]:
        """Obtiene detalles completos de un lugar por su place_id."""
        params = {
            "place_id": place_id,
            "key": self.api_key,
            "language": "es",
            "fields": "name,formatted_phone_number,formatted_address,website,"
                      "international_phone_number,rating,user_ratings_total,types",
        }
        url = "https://maps.googleapis.com/maps/api/place/details/json"

        try:
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("status") != "OK":
                return None

            result = data.get("result", {})
            phone = result.get("formatted_phone_number")
            if not phone:
                phone = result.get("international_phone_number")

            return {
                "nombre": result.get("name", ""),
                "telefono": phone or "",
                "telefono_internacional": result.get("international_phone_number", ""),
                "direccion": result.get("formatted_address", ""),
                "sitio_web": result.get("website", ""),
                "calificacion": result.get("rating"),
                "total_resenas": result.get("user_ratings_total"),
                "categorias": ", ".join(result.get("types", [])),
                "termino_busqueda": "",
                "ubicacion": "",
                "fuente": "Google Places",
            }
        except Exception as e:
            print(f"  Error obteniendo detalle: {e}")
            return None

    def run_all_searches(self) -> List[Dict]:
        """Ejecuta todas las combinaciones de búsqueda."""
        all_businesses = []
        seen = set()

        total = len(config.SEARCH_TERMS) * len(config.LOCATIONS)
        count = 0

        for term in config.SEARCH_TERMS:
            for location in config.LOCATIONS:
                count += 1
                print(f"\n[{count}/{total}] Buscando: '{term}' en '{location}'...")
                businesses = self.search_businesses(term, location)

                for biz in businesses:
                    biz["termino_busqueda"] = term
                    biz["ubicacion"] = location
                    # Evitar duplicados por nombre + teléfono
                    key = (biz["nombre"], biz["telefono"])
                    if key not in seen:
                        seen.add(key)
                        all_businesses.append(biz)

                time.sleep(config.REQUEST_DELAY)

        print(f"\nTotal empresas únicas encontradas: {len(all_businesses)}")
        return all_businesses


if __name__ == "__main__":
    scraper = GooglePlacesScraper()
    results = scraper.run_all_searches()
    print(f"\nResultados: {len(results)}")
