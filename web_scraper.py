"""
Módulo de scraping web
Busca empresas en directorios web y extrae datos desde páginas
"""

import requests
import time
import re
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import config
from phone_extractor import PhoneExtractor


class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/125.0.0.0 Safari/537.36",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        })
        self.phone_extractor = PhoneExtractor()

    def search_directory(self, directory_url: str, term: str, max_pages: int = 3) -> List[Dict]:
        """Busca empresas en un directorio web."""
        results = []

        for page in range(1, max_pages + 1):
            url = self._build_directory_url(directory_url, term, page)
            print(f"  Scrapeando: {url}")

            try:
                resp = self.session.get(url, timeout=15)
                if resp.status_code != 200:
                    break

                companies = self._parse_directory_page(resp.text, directory_url)
                if not companies:
                    break

                results.extend(companies)
                time.sleep(config.REQUEST_DELAY)

            except Exception as e:
                print(f"    Error: {e}")
                break

        return results

    def _build_directory_url(self, base_url: str, term: str, page: int) -> str:
        """Construye URL de búsqueda según el directorio."""
        term_encoded = term.replace(" ", "+")
        if "paginasamarillas" in base_url:
            return f"https://www.paginasamarillas.com.co/buscar/{term_encoded}?page={page}"
        elif "infoempresa" in base_url:
            return f"https://www.infoempresa.com.co/buscar?q={term_encoded}&page={page}"
        else:
            return f"https://www.google.com/search?q={term_encoded}+empresa+Colombia&start={(page-1)*10}"

    def _parse_directory_page(self, html: str, source: str) -> List[Dict]:
        """Parsea una página de resultados de directorio."""
        soup = BeautifulSoup(html, 'html.parser')
        companies = []

        # Buscar bloques de empresas (estructura genérica)
        blocks = soup.find_all(['div', 'article'], class_=re.compile(
            r'(result|item|company|business|card|listing|empresa)', re.I
        ))

        for block in blocks:
            text = block.get_text()
            name_tag = block.find(['h2', 'h3', 'h4', 'strong', 'a'], class_=re.compile(
                r'(name|title|company|business|empresa)', re.I
            ))
            name = name_tag.get_text(strip=True) if name_tag else ""

            if not name or len(name) < 3:
                continue

            phones = self.phone_extractor.extract_all(text)
            emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', text)

            link_tag = block.find('a', href=True)
            website = ""
            if link_tag:
                href = link_tag['href']
                if href.startswith('http'):
                    website = href

            companies.append({
                "nombre": name.strip(),
                "telefono": "; ".join(phones[:3]),
                "telefonos_adicionales": phones,
                "email": emails[0] if emails else "",
                "emails_adicionales": emails,
                "sitio_web": website,
                "direccion": "",
                "fuente": f"Web: {source}",
                "termino_busqueda": "",
            })

        return companies

    def scrape_website_for_contacts(self, url: str) -> Dict:
        """Navega un sitio web y extrae datos de contacto."""
        data = {
            "telefonos": [],
            "emails": [],
            "direccion": "",
        }

        try:
            resp = self.session.get(url, timeout=15)
            if resp.status_code != 200:
                return data

            html = resp.text
            soup = BeautifulSoup(html, 'html.parser')

            # Extraer teléfonos
            data["telefonos"] = self.phone_extractor.extract_from_html(html)

            # Extraer emails
            data["emails"] = list(set(
                re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', html)
            ))

            # Buscar página de contacto
            contact_links = soup.find_all('a', href=re.compile(r'(contacto|contact|nosotros|about)', re.I))
            for link in contact_links:
                href = link.get('href', '')
                if not href.startswith('http'):
                    href = urljoin(url, href)
                if href != url:
                    try:
                        time.sleep(config.REQUEST_DELAY)
                        resp2 = self.session.get(href, timeout=10)
                        if resp2.status_code == 200:
                            phones2 = self.phone_extractor.extract_from_html(resp2.text)
                            data["telefonos"].extend(p for p in phones2 if p not in data["telefonos"])
                            emails2 = re.findall(
                                r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', resp2.text
                            )
                            data["emails"].extend(e for e in emails2 if e not in data["emails"])
                    except:
                        pass

        except Exception as e:
            print(f"    Error scrapeando {url}: {e}")

        return data

    def enrich_from_website(self, company: Dict) -> Dict:
        """Enriquece datos de una empresa scrapeando su sitio web."""
        website = company.get("sitio_web", "")
        if not website or website == "":
            return company

        print(f"  Escaneando sitio web: {website}")
        contact_data = self.scrape_website_for_contacts(website)

        if contact_data["telefonos"] and not company.get("telefono"):
            company["telefono"] = "; ".join(contact_data["telefonos"][:3])
            company["telefonos_adicionales"] = contact_data["telefonos"]

        if contact_data["emails"] and not company.get("email"):
            company["email"] = contact_data["emails"][0]
            company["emails_adicionales"] = contact_data["emails"]

        if contact_data["direccion"] and not company.get("direccion"):
            company["direccion"] = contact_data["direccion"]

        return company


if __name__ == "__main__":
    scraper = WebScraper()
    data = scraper.scrape_website_for_contacts("https://ejemplo.com/contacto")
    print(data)
