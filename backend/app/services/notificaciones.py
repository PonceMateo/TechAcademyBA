"""Interfaz de envío de correo y su implementación de desarrollo (6.1, D17).

D17: la interfaz informa el resultado y **no lanza excepción**. La razón es concreta y sale
de la historia #13: si el alta del alumno se completó pero el correo falló, el alumno tiene
que quedar registrado y el administrador tiene que enterarse del fallo. Con excepciones, el
`except` de la capa de negocio tendría que distinguir "falló el alta" de "falló el correo",
que es justo la ambigüedad que el criterio de aceptación quiere evitar. Con un resultado
explícito no hay nada que distinguir: el alta se confirma y el correo se reporta.

Este change **no elige proveedor**. La única implementación disponible es la de desarrollo,
que escribe el mensaje en el log y no contacta a nadie. La implementación se resuelve por
`EMAIL_BACKEND`, así que agregar una real es registrarla en `IMPLEMENTACIONES` y cambiar la
variable: el código que consume la interfaz no se toca.

El módulo se llama `notificaciones` y no `emails` a propósito: `emails.py` ya existe y es
la regla de unicidad de correo entre padrones (M1), que no tiene nada que ver con enviar.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol, runtime_checkable

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Mensaje:
    """Un correo para enviar. Los textos van en es-AR (D19)."""

    destinatario: str
    asunto: str
    cuerpo: str


@dataclass(frozen=True)
class ResultadoEnvio:
    """Cómo terminó el envío. Se devuelve siempre; nunca se lanza excepción."""

    exito: bool
    #: Mensaje para el log y para el informe al administrador. Es un texto de ejemplo, no
    #: un código de error de proveedor: este change no habla con ningún proveedor.
    detalle: str
    mensaje: Mensaje

    @classmethod
    def enviado(cls, mensaje: Mensaje, detalle: str = "registrado en el log") -> ResultadoEnvio:
        return cls(exito=True, detalle=detalle, mensaje=mensaje)

    @classmethod
    def fallido(cls, mensaje: Mensaje, detalle: str) -> ResultadoEnvio:
        return cls(exito=False, detalle=detalle, mensaje=mensaje)


@runtime_checkable
class EmailService(Protocol):
    """Lo que la aplicación le pide al correo. Un solo método, a propósito.

    Agregar un método "adjuntar", "programar" o "responder" es agregar una necesidad, no una
    abstracción preventiva: el único consumidor real hoy es la carga inicial (6.2).
    """

    def enviar(self, mensaje: Mensaje) -> ResultadoEnvio:
        """Envía el mensaje y devuelve cómo terminó. No lanza excepción."""
        ...


class EmailServiceLog:
    """Implementación de desarrollo: escribe el mensaje en el log y no sale a la red.

    No importa `smtplib` ni `socket` a propósito, y por eso no hay forma de que un cambio
    futuro los agregue sin que la prueba de 6.1 que cuenta los imports lo note.
    """

    def enviar(self, mensaje: Mensaje) -> ResultadoEnvio:
        logger.info(
            "Correo registrado en el log (no se envía a nadie).\n"
            "  Para: %s\n  Asunto: %s\n  Cuerpo:\n%s",
            mensaje.destinatario,
            mensaje.asunto,
            mensaje.cuerpo,
        )
        return ResultadoEnvio.enviado(mensaje)


#: Resolución por configuración. Una implementación real entra agregándose acá y cambiando
#: `EMAIL_BACKEND`; ninguna otra línea del proyecto cambia.
IMPLEMENTACIONES: dict[str, type[EmailService]] = {"log": EmailServiceLog}


@lru_cache(maxsize=1)
def get_email_service() -> EmailService:
    """Devuelve la implementación que pide `EMAIL_BACKEND`.

    Un valor desconocido falla en voz alta en vez de caer al log en silencio. `.env.example`
    menciona `smtp` entre los valores admitidos, pero este change no lo implementa y no
    elige proveedor: fingir que un SMTP configurado está enviando sería peor que no
    arrancar. Cuando el proveedor entre, se agrega su entrada en `IMPLEMENTACIONES`.
    """
    nombre = get_settings().email_backend.strip().lower()
    try:
        implementacion = IMPLEMENTACIONES[nombre]
    except KeyError:
        disponibles = ", ".join(sorted(IMPLEMENTACIONES))
        raise RuntimeError(
            f"EMAIL_BACKEND={nombre!r} no corresponde a ninguna implementación de correo. "
            f"Disponibles: {disponibles}."
        ) from None
    return implementacion()
