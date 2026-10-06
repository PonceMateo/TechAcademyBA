"""Carga inicial: las tres cuentas de demostración (6.2, D18).

Ejecutable con `python -m app.services.seed`. Es **idempotente**: se puede correr dos veces
seguidas sin duplicar registros ni fallar, y la segunda corrida deja lo mismo que la
primera.

**Upsert por clave natural.** Cada cuenta se busca por la clave que la identifica en el
dominio —el email de `usuario`, el CUIL del `docente`, el documento del `alumno`— y se
inserta o se actualiza. No se busca "la última cuenta creada" ni se usa un contador: la
clave natural es la que evita que dos corridas se peleen por el mismo registro.

Se optó por buscar y decidir en Python en lugar de `INSERT ... ON CONFLICT`: la operación
corre dentro de una transacción que el entry point controla, el objeto del ORM queda vivo y
la regla se lee en un solo lugar. `ON CONFLICT` daría menos idas y vueltas y atómicaidad
extra ante dos seeds concurrentes, a cambio de SQL específico del dialecto y de perder el
objeto de ORM. Para una carga inicial disparada por una persona, el canje no vale.

La carga **converge** la fila al dato declarado: si el DNI del docente de ejemplo ya
estuviera en uso, la carga le cambia el correo y el nombre a esa fila. Los datos del ejemplo
son ficticios (D22), así que el riesgo es teórico, y `ensure_email_available` impide que ese
cambio le pise el correo a un tercero.

**El docente se busca por su DNI normalizado, no por su CUIL.** El CUIL dejó de ser
obligatorio en D33, y una columna que admite nulos no puede ser la clave natural del upsert.
El `dni_norm` sigue siendo único y obligatorio, así que cumple el mismo papel.

**D18: las tres cuentas quedan con `must_change_password = false`.** El modelo dice que las
cuentas de docente y alumno nacen con el indicador en `true` (historias #9 y #13), pero este
change no implementa el cambio de contraseña. Con el indicador en `true` el usuario caería
en un flujo inexistente y no llegaría al shell, que es el punto 2 de la Definition of Done.
Es una concesión del entorno de demostración, no del modelo.

**El correo no manda sobre las cuentas.** Cada cuenta recibe un aviso con sus credenciales
a través de la interfaz de D17, que informa el resultado sin lanzar excepción. Si el aviso
no sale, las cuentas quedan igual: es exactamente el escenario que la historia #13 describe
para el alta de un alumno.
"""

from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hashear_password, verificar_password
from app.models.enums import Rol, TipoDocumento
from app.models.padron import Alumno, Docente, Usuario
from app.services.emails import ensure_email_available
from app.services.normalization import normalize_document
from app.services.notificaciones import EmailService, Mensaje, ResultadoEnvio, get_email_service

logger = logging.getLogger(__name__)

#: Contraseña de las tres cuentas de demostración. Es pública a propósito: es lo que pide la
#: spec para el entorno de desarrollo y lo que el README documenta. Las cuentas reales
#: nunca se crean con esta contraseña.
CONTRASEÑA_DEMO = "Demo2026!"


@dataclass(frozen=True)
class CuentaDemo:
    """Lo que hay que dejar en la base, más lo que se le escribe a la persona."""

    email: str
    nombre: str
    rol: Rol
    #: Datos del registro de padrón que el CHECK de D4 obliga a crear. `ADMIN` no lleva
    #: ninguno.
    docente: dict[str, Any] | None = None
    alumno: dict[str, Any] | None = None


CUENTAS_DEMO: tuple[CuentaDemo, ...] = (
    CuentaDemo(
        email="admin@techacademy.invalid",
        # D3: Administración y Secretaría son el mismo rol y la interfaz lo muestra como
        # "Secretaría". El nombre de la cuenta ya dice cuál de las dos denominaciones se ve.
        nombre="Secretaria BA",
        rol=Rol.ADMIN,
    ),
    CuentaDemo(
        email="rita.molina@techacademy.invalid",
        nombre="Rita Molina",
        rol=Rol.DOCENTE,
        docente={
            "nombre": "Rita",
            "apellido": "Molina",
            "dni": "30111222",
            "cuil": "27345678907",
            "telefono": "+54 11 4000-0001",
        },
    ),
    CuentaDemo(
        email="agustina.benitez@techacademy.invalid",
        nombre="Agustina Benítez",
        rol=Rol.ALUMNO,
        alumno={
            "documento": "38111222",
            "tipo_documento": TipoDocumento.DNI.value,
            "telefono": "+54 11 4000-0002",
        },
    ),
)


@dataclass(frozen=True)
class CuentaCargada:
    """Qué pasó con una cuenta en esta corrida."""

    email: str
    rol: str
    usuario_id: int
    creada: bool
    correo: ResultadoEnvio

    @property
    def correo_fallido(self) -> bool:
        return not self.correo.exito


@dataclass(frozen=True)
class ResultadoCargaInicial:
    """Resumen de la corrida, que es lo que el entry point imprime."""

    cuentas: tuple[CuentaCargada, ...]

    @property
    def creadas(self) -> int:
        return sum(1 for cuenta in self.cuentas if cuenta.creada)

    @property
    def actualizadas(self) -> int:
        return sum(1 for cuenta in self.cuentas if not cuenta.creada)

    @property
    def correos_fallidos(self) -> tuple[CuentaCargada, ...]:
        return tuple(cuenta for cuenta in self.cuentas if cuenta.correo_fallido)


def cargar_datos_iniciales(
    session: Session,
    *,
    email_service: EmailService | None = None,
) -> ResultadoCargaInicial:
    """Deja las tres cuentas de demostración y devuelve el resumen.

    **No confirma la transacción.** El entry point es el dueño del límite de transacción, y
    así una prueba puede correr la carga dentro de su propia transacción y descartarla al
    terminar. Todo lo que se escribe queda pendiente hasta que el entry point confirme.

    `email_service` existe para poder pasar una implementación que falla y comprobar que el
    fallo se informa sin deshacer las cuentas (6.1). Por defecto se resuelve la de
    configuración.
    """
    servicio = get_email_service() if email_service is None else email_service

    cargadas: list[CuentaCargada] = []
    for cuenta in CUENTAS_DEMO:
        usuario, creada = _upsert_cuenta(session, cuenta)
        correo = servicio.enviar(_mensaje_de_bienvenida(cuenta))
        if not correo.exito:
            logger.warning(
                "El aviso a %s no salió, pero la cuenta quedó creada: %s",
                cuenta.email,
                correo.detalle,
            )
        cargadas.append(
            CuentaCargada(
                email=cuenta.email,
                rol=cuenta.rol.value,
                usuario_id=usuario.id,
                creada=creada,
                correo=correo,
            )
        )

    session.flush()
    return ResultadoCargaInicial(cuentas=tuple(cargadas))


def _upsert_cuenta(session: Session, cuenta: CuentaDemo) -> tuple[Usuario, bool]:
    """Inserta o actualiza la cuenta y su registro de padrón. Devuelve si la creó."""
    docente = _upsert_docente(session, cuenta) if cuenta.docente else None
    alumno = _upsert_alumno(session, cuenta) if cuenta.alumno else None
    usuario = session.scalar(select(Usuario).where(Usuario.email == cuenta.email))

    # M1: la unicidad cruzada entre padrones la verifica el servicio. Se excluyen los
    # registros de la persona que se está creando —el `usuario` es la misma dirección que
    # ya está en `docente` o en `alumno`— porque no es un choque con otra persona. Por eso
    # `usuario` se busca **antes**: si no, la segunda corrida encontraría su propia cuenta
    # y se declararía en conflicto con ella misma.
    ensure_email_available(
        session,
        cuenta.email,
        exclude_docente_id=docente.id if docente else None,
        exclude_alumno_id=alumno.id if alumno else None,
        exclude_usuario_id=usuario.id if usuario else None,
    )

    creada = usuario is None
    if usuario is None:
        usuario = Usuario(
            email=cuenta.email,
            nombre=cuenta.nombre,
            rol=cuenta.rol.value,
            password_hash=hashear_password(CONTRASEÑA_DEMO),
            # D18: sin cambio pendiente. Ver la nota del módulo.
            must_change_password=False,
            is_active=True,
            docente_id=docente.id if docente else None,
            alumno_id=alumno.id if alumno else None,
        )
        session.add(usuario)
        session.flush()
        return usuario, creada

    usuario.nombre = cuenta.nombre
    usuario.rol = cuenta.rol.value
    usuario.docente_id = docente.id if docente else None
    usuario.alumno_id = alumno.id if alumno else None
    usuario.is_active = True
    usuario.must_change_password = False
    # Solo se rehashea si la contraseña guardada no es la de demostración. Así la segunda
    # corrida no gasta un hash, y una cuenta a la que alguien le cambió la contraseña
    # vuelve a quedar con la documentada.
    if not verificar_password(CONTRASEÑA_DEMO, usuario.password_hash):
        usuario.password_hash = hashear_password(CONTRASEÑA_DEMO)
    return usuario, False


def _upsert_docente(session: Session, cuenta: CuentaDemo) -> Docente:
    """El docente de la cuenta, buscándolo por su DNI normalizado.

    **Por qué el DNI y no el CUIL:** hasta D33 el CUIL era obligatorio y único, así que era
    la clave natural. D33 lo volvió opcional —en esta fase los docentes no son personas
    reales y un CUIL inventado es peor que ninguno— y una columna que admite nulos no puede
    ser la clave de búsqueda. `dni_norm` sigue siendo única, obligatoria y la tiene la fila de
    ejemplo, así que cumple el mismo papel.
    """
    datos = dict(cuenta.docente or {})
    dni_norm = normalize_document(datos["dni"])
    docente = session.scalar(select(Docente).where(Docente.dni_norm == dni_norm))
    if docente is None:
        docente = Docente(
            nombre=datos["nombre"],
            apellido=datos["apellido"],
            dni=datos["dni"],
            dni_norm=dni_norm,
            # D33: el CUIL es opcional. La fila de ejemplo lo trae, porque el CUIL de
            # Rita es de uso interno del seed y no un dato inventado por la aplicación.
            cuil=datos.get("cuil"),
            # El correo del padrón es el mismo que el de acceso: es la misma persona y la
            # tabla de identidad manda. `ensure_email_available` excluye esta fila.
            email=cuenta.email,
            telefono=datos.get("telefono"),
            activo=True,
        )
        session.add(docente)
        session.flush()
        return docente

    docente.email = cuenta.email
    docente.activo = True
    docente.telefono = datos.get("telefono")
    return docente


def _upsert_alumno(session: Session, cuenta: CuentaDemo) -> Alumno:
    """El alumno de la cuenta, buscándolo por su documento normalizado."""
    datos = dict(cuenta.alumno or {})
    documento_norm = normalize_document(datos["documento"])
    alumno = session.scalar(select(Alumno).where(Alumno.documento_norm == documento_norm))
    if alumno is None:
        alumno = Alumno(
            nombre=cuenta.nombre,
            documento=datos["documento"],
            documento_norm=documento_norm,
            tipo_documento=datos["tipo_documento"],
            email=cuenta.email,
            telefono=datos.get("telefono"),
            activo=True,
        )
        session.add(alumno)
        session.flush()
        return alumno

    alumno.nombre = cuenta.nombre
    alumno.email = cuenta.email
    alumno.activo = True
    alumno.telefono = datos.get("telefono")
    return alumno


def _mensaje_de_bienvenida(cuenta: CuentaDemo) -> Mensaje:
    """El aviso con las credenciales. Texto de interfaz, en es-AR (D19)."""
    cuerpo = (
        f"Hola, {cuenta.nombre}:\n"
        "\n"
        "Estas son las credenciales de tu cuenta de demostración en TechAcademy BA:\n"
        "\n"
        f"    Correo:      {cuenta.email}\n"
        f"    Contraseña:  {CONTRASEÑA_DEMO}\n"
        "\n"
        "Es un entorno de demostración. Las cuentas las crea la carga inicial, no "
        "contienen datos reales y no piden cambio de contraseña.\n"
        "\n"
        "Saludos,\n"
        "Secretaría BA\n"
    )
    return Mensaje(
        destinatario=cuenta.email,
        asunto="Tu cuenta de demostración en TechAcademy BA",
        cuerpo=cuerpo,
    )


def main() -> int:
    """Entry point de `python -m app.services.seed`.

    Devuelve 0 aunque algún aviso no salga: las cuentas están, que es lo que el comando
    promete, y el aviso fallido queda en la salida y en el log. Devolver distinto de cero
    haría que un `docker compose run` fallara por un correo que en este change nadie manda.
    """
    from app.core.database import SessionLocal

    session = SessionLocal()
    try:
        resultado = cargar_datos_iniciales(session)
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("La carga inicial falló y se revirtió.")
        raise
    finally:
        session.close()

    _imprimir(resultado)
    return 0


def _imprimir(resultado: ResultadoCargaInicial) -> None:
    print("Carga inicial de TechAcademy BA")
    print(f"  Cuentas creadas:     {resultado.creadas}")
    print(f"  Cuentas actualizadas: {resultado.actualizadas}")
    print()
    for cuenta in resultado.cuentas:
        if cuenta.correo.exito:
            estado_correo = "aviso registrado en el log"
        else:
            estado_correo = cuenta.correo.detalle
        print(f"  {cuenta.rol:<7} {cuenta.email}  (id {cuenta.usuario_id}) — {estado_correo}")
    print()
    print(f"  Contraseña de las tres cuentas: {CONTRASEÑA_DEMO}")
    if resultado.correos_fallidos:
        print()
        print("  AVISO: no se pudo enviar el correo de:")
        for cuenta in resultado.correos_fallidos:
            print(f"    - {cuenta.email}: {cuenta.correo.detalle}")
        print("  Las cuentas quedaron creadas igual. Revisá el proveedor de correo.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)-5.5s %(name)s %(message)s")
    sys.exit(main())
