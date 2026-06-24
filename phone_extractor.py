"""
Módulo de extracción de teléfonos desde texto/html
Detecta números colombianos e internacionales en múltiples formatos
"""

import re
from typing import List


class PhoneExtractor:
    """Extrae números de teléfono de texto plano usando patrones."""

    # Patrones de teléfonos colombianos
    COLOMBIA_PATTERNS = [
        # +57 300 123 4567
        r'\+57[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}',
        # 57 300 123 4567
        r'57[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}',
        # 300 123 4567 (celular)
        r'(?:300|301|302|303|304|305|310|311|312|313|314|315|316|317|318|319|320|321|322|323|324|350|351|352|353|354|355|356|357|358|359|360|361|362|363|364|365|366|367|368|369|370|371|372|373|374|375|376|377|378|379|380|381|382|383|384|385|386|387|388|389|390|391|392|393|394|395|396|397|398|399)[\s\-]?\d{3}[\s\-]?\d{4}',
        # Fijo: 1 234 5678 (Bogotá)
        r'(?:1|2|4|5|6|7|8)[\s\-]?\d{3}[\s\-]?\d{4}',
    ]

    GENERAL_PATTERNS = [
        # Internacional: +1 (555) 123-4567
        r'\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}',
        # Internacional sin código país largo
        r'\+\d{7,15}',
        # Números con formato libre (mín 7 dígitos)
        r'\b\d{7,10}\b',
    ]

    def extract_all(self, text: str) -> List[str]:
        """Extrae todos los números de teléfono de un texto."""
        phones = set()

        for pattern in self.COLOMBIA_PATTERNS:
            matches = re.findall(pattern, text)
            for m in matches:
                cleaned = self._clean_number(m)
                if cleaned:
                    phones.add(cleaned)

        for pattern in self.GENERAL_PATTERNS:
            matches = re.findall(pattern, text)
            for m in matches:
                cleaned = self._clean_number(m)
                if cleaned and len(cleaned) >= 7:
                    phones.add(cleaned)

        return sorted(phones)

    def _clean_number(self, number: str) -> str:
        """Limpia y normaliza un número de teléfono."""
        # Remover todo excepto dígitos y +
        cleaned = re.sub(r'[^\d+]', '', number)
        # Si empieza con +, mantener
        if cleaned.startswith('+'):
            return cleaned
        # Si tiene 10 dígitos y empieza con 3, agregar +57
        if len(cleaned) == 10 and cleaned.startswith('3'):
            return f'+57{cleaned}'
        # Si tiene 7 dígitos, es fijo (asumir Bogotá +571)
        if len(cleaned) == 7:
            return f'+571{cleaned}'
        return cleaned

    def extract_from_html(self, html: str) -> List[str]:
        """Extrae teléfonos de código HTML."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        # Buscar en atributos href="tel:..."
        phones = set()
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            if href.startswith('tel:'):
                phones.add(href.replace('tel:', '').strip())

        # Buscar en todo el texto de la página
        text = soup.get_text()
        phones.update(self.extract_all(text))

        return sorted(phones)


if __name__ == "__main__":
    extractor = PhoneExtractor()
    test = """
    Llámanos al +57 300 123 4567 o al 310 555 8888
    También al (1) 234 5678 y al +57 315 987 6543
    Nuestro WhatsApp: 320 123 4567
    """
    phones = extractor.extract_all(test)
    for p in phones:
        print(p)
