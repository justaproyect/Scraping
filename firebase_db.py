"""
Módulo de integración con Firebase Firestore
Guardar, consultar y evitar duplicados de empresas
"""

import json
import os
from typing import List, Dict, Optional
from datetime import datetime
import config


class FirebaseDB:
    def __init__(self, credentials_path: str = None):
        self.credentials_path = credentials_path or config.FIREBASE_CREDENTIALS_PATH
        self.db = None
        self._connected = False

    def connect(self) -> bool:
        """Conecta a Firebase Firestore."""
        if self._connected:
            return True

        if not os.path.exists(self.credentials_path):
            print(f"[!] Archivo de credenciales no encontrado: {self.credentials_path}")
            print("    Para configurar Firebase:")
            print("    1. Ve a https://console.firebase.google.com")
            print("    2. Crea un proyecto o usa uno existente")
            print("    3. Proyecto -> Configuración -> Cuentas de servicio")
            print("    4. 'Generar nueva clave privada' -> descarga el JSON")
            print(f"    5. Guarda el archivo como '{self.credentials_path}'")
            return False

        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            cred = credentials.Certificate(self.credentials_path)
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            self._connected = True
            print("[✓] Conexión a Firebase Firestore exitosa")
            return True

        except ImportError:
            print("[!] firebase-admin no instalado. Ejecuta: pip install firebase-admin")
            return False
        except Exception as e:
            print(f"[!] Error conectando a Firebase: {e}")
            return False

    def save_company(self, company: Dict) -> bool:
        """Guarda una empresa en Firestore si no existe (evita duplicados)."""
        if not self._connected:
            return False

        try:
            doc_id = self._generate_doc_id(company)
            collection = self.db.collection(config.FIRESTORE_COLLECTION)

            # Verificar si ya existe
            existing = collection.document(doc_id).get()
            if existing.exists:
                # Actualizar timestamp y fusionar datos
                existing_data = existing.to_dict()
                current_numbers = existing_data.get("telefonos_adicionales", [])
                new_numbers = company.get("telefonos_adicionales", [])

                all_numbers = list(set(current_numbers + new_numbers))
                existing_data["telefonos_adicionales"] = all_numbers
                existing_data["ultima_actualizacion"] = datetime.now().isoformat()
                existing_data["ultimo_termino"] = company.get("termino_busqueda", "")

                if company.get("telefono") and not existing_data.get("telefono"):
                    existing_data["telefono"] = company["telefono"]

                collection.document(doc_id).update(existing_data)
                return True  # actualizado

            # Nuevo documento
            company["_id"] = doc_id
            company["creado"] = datetime.now().isoformat()
            company["ultima_actualizacion"] = datetime.now().isoformat()
            company["telefonos_adicionales"] = company.get("telefonos_adicionales", [])
            company["emails_adicionales"] = company.get("emails_adicionales", [])

            collection.document(doc_id).set(company)
            return True  # insertado

        except Exception as e:
            print(f"    Error guardando en Firebase: {e}")
            return False

    def save_company_batch(self, companies: List[Dict]) -> tuple:
        """Guarda múltiples empresas. Retorna (insertados, actualizados, errores)."""
        inserted = 0
        updated = 0
        errors = 0

        total = len(companies)
        for i, company in enumerate(companies):
            if (i + 1) % 10 == 0:
                print(f"  Guardando... {i+1}/{total}")

            try:
                doc_id = self._generate_doc_id(company)
                collection = self.db.collection(config.FIRESTORE_COLLECTION)

                existing = collection.document(doc_id).get()
                if existing.exists:
                    existing_data = existing.to_dict()
                    existing_data["ultima_actualizacion"] = datetime.now().isoformat()

                    existing_phones = existing_data.get("telefonos_adicionales", [])
                    new_phones = company.get("telefonos_adicionales", [])
                    existing_data["telefonos_adicionales"] = list(set(existing_phones + new_phones))

                    collection.document(doc_id).update(existing_data)
                    updated += 1
                else:
                    company["_id"] = doc_id
                    company["creado"] = datetime.now().isoformat()
                    company["ultima_actualizacion"] = datetime.now().isoformat()
                    collection.document(doc_id).set(company)
                    inserted += 1

            except Exception as e:
                errors += 1
                print(f"    Error en empresa {i}: {e}")

        return inserted, updated, errors

    def _generate_doc_id(self, company: Dict) -> str:
        """Genera un ID único para el documento basado en nombre y teléfono."""
        name = company.get("nombre", "").strip().lower()
        name = ''.join(c for c in name if c.isalnum() or c in ' _-')[:50]

        phone = company.get("telefono", "").strip()
        phone = ''.join(c for c in phone if c.isdigit())[:15]

        if phone:
            return f"{name}_{phone}"
        return f"{name}_{hash(name) % 10000}"

    def get_all_companies(self) -> List[Dict]:
        """Obtiene todas las empresas de la colección."""
        if not self._connected:
            return []

        try:
            docs = self.db.collection(config.FIRESTORE_COLLECTION).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Error obteniendo empresas: {e}")
            return []

    def count_companies(self) -> int:
        """Cuenta el total de empresas en la base de datos."""
        if not self._connected:
            return 0
        try:
            docs = self.db.collection(config.FIRESTORE_COLLECTION).get()
            return len(docs)
        except:
            return 0


if __name__ == "__main__":
    db = FirebaseDB()
    if db.connect():
        count = db.count_companies()
        print(f"Empresas en base de datos: {count}")
