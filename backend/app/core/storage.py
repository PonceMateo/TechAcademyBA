"""Almacenamiento privado de los comprobantes de alumnos (HU 52).

**El archivo nunca se guarda en una carpeta pública ni en el repositorio.** Las claves las genera
el servidor (`alumno/{alumno_id}/{uuid}`) y el nombre que manda el usuario solo se guarda como
etiqueta de descarga: nunca se usa como ruta.

Hay dos implementaciones:

- `AlmacenamientoLocal`: volumen privado del contenedor para desarrollo y pruebas.
- `AlmacenamientoSupabase`: Supabase Storage con la service role key. En producción la subida va
  del navegador al storage con una URL firmada, para no atravesar el límite de 4,5 MB de la
  Function; el backend firma, verifica y borra.

Sin configuración válida se lanza `AlmacenamientoNoConfigurado`; **no hay fallback insegura**.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from contextlib import suppress
from dataclasses import dataclass, field
from pathlib import Path

from app.core.config import Settings

#: Tiempo máximo de espera contra el storage. Si tarda más, el envío se informa como fallido.
TIMEOUT_SEGUNDOS = 15


class AlmacenamientoNoConfigurado(RuntimeError):
    """Falta configuración o el backend elegido no sirve para el entorno."""


class AlmacenamientoNoDisponible(RuntimeError):
    """El storage no respondió o el objeto no se pudo leer."""


class ClaveInvalida(ValueError):
    """La clave intenta salir del directorio de almacenamiento."""


@dataclass(frozen=True)
class DestinoDeCarga:
    """Cómo subir el archivo. `url` relativa la completa la capa de API."""

    url: str
    metodo: str = "PUT"
    headers: dict[str, str] = field(default_factory=dict)
    expira_segundos: int = 300


class AlmacenamientoLocal:
    """Archivos privados dentro de `STORAGE_LOCAL_DIR` (volumen dedicado en Docker)."""

    def __init__(self, raiz: str | Path) -> None:
        self.raiz = Path(raiz).resolve()

    def _ruta(self, clave: str) -> Path:
        ruta = (self.raiz / clave).resolve()
        if ruta == self.raiz or self.raiz not in ruta.parents:
            raise ClaveInvalida("La clave del comprobante no corresponde a una ruta válida.")
        return ruta

    def destino_de_carga(self, clave: str, mime: str) -> DestinoDeCarga | None:
        return None

    def guardar(self, clave: str, contenido: bytes) -> None:
        ruta = self._ruta(clave)
        ruta.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        ruta.write_bytes(contenido)
        os.chmod(ruta, 0o600)

    def leer(self, clave: str) -> bytes:
        ruta = self._ruta(clave)
        if not ruta.is_file():
            raise AlmacenamientoNoDisponible("El archivo del comprobante no está disponible.")
        return ruta.read_bytes()

    def eliminar(self, clave: str) -> None:
        with suppress(OSError):
            # La limpieza no puede tapar el error original del envío.
            self._ruta(clave).unlink(missing_ok=True)

    def url_descarga(self, clave: str, expira_segundos: int = 300) -> str | None:
        return None


class AlmacenamientoSupabase:
    """Supabase Storage con service role key (producción y despliegue real)."""

    def __init__(self, url: str, service_role_key: str, bucket: str, expira_segundos: int) -> None:
        self.url = url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket
        self.expira_segundos = expira_segundos

    def _objeto(self, clave: str) -> str:
        return f"{self.bucket}/{urllib.parse.quote(clave, safe='/')}"

    def _solicitud(self, metodo: str, ruta: str, cuerpo: object | None = None) -> bytes:
        datos = None if cuerpo is None else json.dumps(cuerpo).encode("utf-8")
        solicitud = urllib.request.Request(
            f"{self.url}/storage/v1{ruta}",
            data=datos,
            method=metodo,
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(solicitud, timeout=TIMEOUT_SEGUNDOS) as respuesta:  # noqa: S310
                return respuesta.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            # El mensaje no incluye la URL firmada ni la credencial.
            raise AlmacenamientoNoDisponible(
                "El almacenamiento de comprobantes no está disponible."
            ) from error

    def _url_absoluta(self, relativa: str) -> str:
        return f"{self.url}/storage/v1{relativa}"

    def destino_de_carga(self, clave: str, mime: str) -> DestinoDeCarga | None:
        cuerpo = self._solicitud("POST", f"/object/upload/sign/{self._objeto(clave)}", {})
        datos = json.loads(cuerpo or b"{}")
        relativa = datos.get("signedURL") or datos.get("url")
        if not isinstance(relativa, str) or relativa == "":
            raise AlmacenamientoNoDisponible(
                "El almacenamiento no devolvió una URL de carga válida."
            )
        return DestinoDeCarga(
            url=self._url_absoluta(relativa),
            metodo="PUT",
            headers={"Content-Type": mime},
            expira_segundos=self.expira_segundos,
        )

    def url_descarga(self, clave: str, expira_segundos: int = 300) -> str | None:
        cuerpo = self._solicitud(
            "POST",
            f"/object/sign/{self._objeto(clave)}",
            {"expiresIn": expira_segundos},
        )
        datos = json.loads(cuerpo or b"{}")
        relativa = datos.get("signedURL") or datos.get("url")
        if not isinstance(relativa, str) or relativa == "":
            raise AlmacenamientoNoDisponible(
                "El almacenamiento no devolvió una URL de descarga válida."
            )
        return self._url_absoluta(relativa)

    def leer(self, clave: str) -> bytes:
        url = self.url_descarga(clave, self.expira_segundos)
        if url is None:
            raise AlmacenamientoNoDisponible("El archivo del comprobante no está disponible.")
        solicitud = urllib.request.Request(url, method="GET")
        try:
            with urllib.request.urlopen(solicitud, timeout=TIMEOUT_SEGUNDOS) as respuesta:  # noqa: S310
                return respuesta.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            raise AlmacenamientoNoDisponible(
                "El archivo del comprobante no está disponible."
            ) from error

    def guardar(self, clave: str, contenido: bytes) -> None:
        # En producción sube el navegador con la URL firmada: el backend no recibe el binario.
        raise AlmacenamientoNoDisponible(
            "Este almacenamiento no admite la carga desde el backend."
        )

    def eliminar(self, clave: str) -> None:
        with suppress(AlmacenamientoNoDisponible):
            self._solicitud("DELETE", f"/object/{self._objeto(clave)}")


def construir_almacenamiento(settings: Settings) -> AlmacenamientoLocal | AlmacenamientoSupabase:
    """Elige el backend configurado o falla con un mensaje para el operador."""
    backend = settings.storage_backend.strip().lower()

    if settings.app_env == "production" and backend == "local":
        raise AlmacenamientoNoConfigurado(
            "El almacenamiento de comprobantes no está configurado para producción."
        )

    if backend == "local":
        return AlmacenamientoLocal(settings.storage_local_dir)

    if backend == "supabase":
        if not (
            settings.supabase_url
            and settings.supabase_service_role_key
            and settings.storage_bucket
        ):
            raise AlmacenamientoNoConfigurado(
                "El almacenamiento de comprobantes no está configurado: faltan SUPABASE_URL,"
                " SUPABASE_SERVICE_ROLE_KEY o STORAGE_BUCKET."
            )
        return AlmacenamientoSupabase(
            url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
            bucket=settings.storage_bucket,
            expira_segundos=settings.storage_url_expira_segundos,
        )

    raise AlmacenamientoNoConfigurado(
        f"STORAGE_BACKEND inválido: {backend!r}. Valores admitidos: 'local' y 'supabase'."
    )
