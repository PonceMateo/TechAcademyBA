"""6.1 — La interfaz de correo y su implementación de desarrollo (D17).

Lo que se verifica acá es el contrato, no el envío: que el resultado sea explícito, que la
implementación de desarrollo no salga a la red, y que un fallo se pueda informar sin
deshacer la operación que lo originó.
"""

from __future__ import annotations

import ast
import logging
import smtplib
import socket
from pathlib import Path

import pytest

from app.core.config import get_settings
from app.services.notificaciones import (
    IMPLEMENTACIONES,
    EmailService,
    EmailServiceLog,
    Mensaje,
    ResultadoEnvio,
    get_email_service,
)

MODULO = Path(__file__).resolve().parents[1] / "services" / "notificaciones.py"

MENSAJE_DE_PRUEBA = Mensaje(
    destinatario="rita.molina@techacademy.invalid",
    asunto="Tu cuenta de demostración en TechAcademy BA",
    cuerpo="Hola, Rita:\n\nEstas son tus credenciales.\n\nSaludos,\nSecretaría BA\n",
)


def test_la_implementacion_de_desarrollo_registra_y_devuelve_exito(caplog) -> None:
    with caplog.at_level(logging.INFO, logger="app.services.notificaciones"):
        resultado = EmailServiceLog().enviar(MENSAJE_DE_PRUEBA)

    assert resultado.exito is True
    assert isinstance(resultado, ResultadoEnvio)
    assert MENSAJE_DE_PRUEBA.destinatario in caplog.text
    assert MENSAJE_DE_PRUEBA.asunto in caplog.text


def test_la_implementacion_de_desarrollo_no_contacta_a_nadie(monkeypatch) -> None:
    """Que no se mande correo es una propiedad de esta implementación, no una promesa.

    Se tapan las dos salidas de red que un proveedor usaría. Si alguien agrega `smtplib` o
    una llamada HTTP al backend de log, la prueba explota.
    """

    def _no_deberia_salir(*args, **kwargs) -> None:
        raise AssertionError("la implementación de desarrollo intentó salir a la red")

    monkeypatch.setattr(socket, "create_connection", _no_deberia_salir)
    monkeypatch.setattr(socket, "socket", _no_deberia_salir)
    monkeypatch.setattr(smtplib, "SMTP", _no_deberia_salir)

    resultado = EmailServiceLog().enviar(MENSAJE_DE_PRUEBA)

    assert resultado.exito is True


def test_el_modulo_de_correo_no_importa_ningun_medio_de_transporte() -> None:
    """Guardia estática del anterior: ni `smtplib`, ni `socket`, ni un cliente HTTP.

    Los `# import` comentarios que alguna vez se agreguen no cuentan, así que se lee el
    árbol de sintaxis y no el texto.
    """
    arbol = ast.parse(MODULO.read_text(encoding="utf-8"), filename=str(MODULO))
    importados: set[str] = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            importados.update(alias.name for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom) and nodo.module:
            importados.add(nodo.module)

    prohibidos = {"smtplib", "socket", "httpx", "requests", "urllib3", "http"}
    assert not (importados & prohibidos), f"el servicio de correo no habla con nadie: {importados}"


def test_el_envio_nunca_lanza_excepción() -> None:
    """D17: el contrato es devolver, no lanzar.

    Si la implementación lanzara, el `except` de la capa de negocio tendría que distinguir
    "falló el alta" de "falló el correo", que es exactamente la ambigüedad que la historia
    #13 quiere evitar.
    """
    servicio = EmailServiceLog()
    for mensaje in (
        MENSAJE_DE_PRUEBA,
        Mensaje(destinatario="", asunto="", cuerpo=""),
        Mensaje(destinatario="no-es-un-correo", asunto="x" * 500, cuerpo="\n"),
    ):
        resultado = servicio.enviar(mensaje)
        assert resultado.exito is True


def test_un_fallo_se_informa_con_un_resultado_y_sin_excepción() -> None:
    """El escenario "Fallo de envío informado" de la spec, del lado de la interfaz."""

    class ServicioQueFalla:
        def enviar(self, mensaje: Mensaje) -> ResultadoEnvio:
            return ResultadoEnvio.fallido(mensaje, "el proveedor rechazó el mensaje")

    resultado = ServicioQueFalla().enviar(MENSAJE_DE_PRUEBA)

    assert resultado.exito is False
    assert resultado.detalle == "el proveedor rechazó el mensaje"
    assert resultado.mensaje is MENSAJE_DE_PRUEBA


def test_toda_implementacion_cumple_la_interfaz() -> None:
    """La interfaz es un `Protocol` con un solo método: una implementación real tiene que
    poder registrarse sin cambiar la interfaz."""
    for nombre, implementacion in IMPLEMENTACIONES.items():
        assert issubclass(implementacion, EmailService), nombre
        assert callable(implementacion.enviar), nombre


def test_la_resolucion_ocurre_por_configuracion(monkeypatch) -> None:
    """Spec, "Implementación intercambiable": cambiar la variable cambia la implementación
    y no cambia el código que la consume."""
    get_email_service.cache_clear()
    try:
        assert isinstance(get_email_service(), EmailServiceLog)

        class ServicioReal:
            def enviar(self, mensaje: Mensaje) -> ResultadoEnvio:
                return ResultadoEnvio.enviado(mensaje)

        monkeypatch.setitem(IMPLEMENTACIONES, "real", ServicioReal)
        monkeypatch.setattr(get_settings(), "email_backend", "real", raising=False)
        get_email_service.cache_clear()

        assert isinstance(get_email_service(), ServicioReal)
    finally:
        get_email_service.cache_clear()


def test_un_backend_desconocido_falla_en_voz_alta(monkeypatch) -> None:
    """Fingir que un SMTP configurado está enviando sería peor que no arrancar."""
    monkeypatch.setattr(get_settings(), "email_backend", "smtp", raising=False)
    get_email_service.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="log"):
            get_email_service()
    finally:
        get_email_service.cache_clear()
