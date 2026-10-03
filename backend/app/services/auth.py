"""Reglas de autenticación: qué cuenta corresponde a un par de credenciales (5.2).

Vive en `services` y no en el router porque es una regla de negocio, no un detalle de
transporte (D1). La ruta solo traduce el resultado a un código HTTP.

**El mensaje es uno solo.** La spec de `auth-and-roles` pide que el sistema no revele cuál
de los dos datos falló, y `POST /auth/login` tiene que devolver exactamente el mismo cuerpo
para un correo inexistente y para una contraseña incorrecta (5.5). Por eso la respuesta no
se arma en la ruta sino acá, en un solo lugar: si dos rutas escribieran el mensaje cada
una, la igualdad de 5.5 sería casualidad y no una garantía.
"""

from __future__ import annotations

import logging
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hashear_password, verificar_password
from app.models.padron import Usuario

logger = logging.getLogger(__name__)

#: Único mensaje para cualquier falla de credenciales. No es el mismo texto que el de la
#: dependencia de autorización: uno habla del par correo y contraseña, el otro del token
#: que falta o no sirve, y mezclarlos sería menos claro sin ganar nada.
CREDENCIALES_INVALIDAS = "Credenciales inválidas."


class CredencialesInvalidas(Exception):
    """No hay una cuenta con ese correo, o la contraseña no coincide.

    No distingue un caso del otro, y `args` siempre lleva el mismo texto, para que el
    `detail` que arma la ruta sea idéntico en los dos casos.
    """

    def __init__(self) -> None:
        super().__init__(CREDENCIALES_INVALIDAS)


#: Hash de referencia para igualar el tiempo de respuesta entre "no existe" y "no coincide".
#: Se construye una sola vez, con un secreto aleatorio, y no se versiona: un hash bcrypt
#: committed en el repositorio parece una credencial y no lo es.
_hash_de_referencia: str | None = None


def autenticar(session: Session, email: str, password: str) -> Usuario:
    """Devuelve la cuenta que corresponde al par de credenciales, o falla.

    Falla con `CredencialesInvalidas` en los cuatro casos: correo inexistente, contraseña
    incorrecta, cuenta dada de baja y cuenta inexistente por otra razón. No hay excepción
    para "usuario no encontrado" porque una excepción distinta se convierte tarde o tarde
    en un mensaje distinto, y ese es exactamente el agujero que la spec quiere cerrar.
    """
    usuario = session.scalar(select(Usuario).where(Usuario.email == email))

    if usuario is None:
        # Se verifica un hash de todas formas. Sin esto, un correo inexistente respondería
        # en microsegundos y uno existenten en ~250 ms, y la diferencia ya revela qué
        # correos existen sin que ninguna respuesta lo diga.
        verificar_password(password, _hash_para_comparar())
        logger.info("Intento de acceso con un correo que no está registrado.")
        raise CredencialesInvalidas

    if not usuario.is_active:
        # Misma respuesta que una contraseña incorrecta: si una cuenta dada de baja
        # respondiera distinto, la respuesta confirmaría que el correo existe.
        logger.info("Intento de acceso a una cuenta dada de baja.")
        raise CredencialesInvalidas

    if not verificar_password(password, usuario.password_hash):
        logger.info("Intento de acceso con contraseña incorrecta.")
        raise CredencialesInvalidas

    return usuario


def _hash_para_comparar() -> str:
    """Hash válido de un secreto que se tira a la basura, construído una sola vez."""
    global _hash_de_referencia
    if _hash_de_referencia is None:
        _hash_de_referencia = hashear_password(secrets.token_urlsafe(32))
    return _hash_de_referencia
