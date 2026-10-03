"""Enums del dominio (D23).

El enum es la autoridad, no los rótulos del Excel del cliente: el texto libre de la
planilla no es un estado del dominio y por eso no se copia acá.

Cada enum se persiste como `VARCHAR` con un CHECK explícito `col IN (...)` generado
desde los miembros del enum. No se usa un tipo ENUM nativo de PostgreSQL a propósito:
Alembic no emite el `CREATE TYPE` por su cuenta, y una restricción que hay que
reconstruir a mano en cada migración es exactamente lo que D16 quiere evitar.
"""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import CheckConstraint


class Modalidad(StrEnum):
    """Modalidad de una comisión (historia #8)."""

    VIRTUAL = "VIRTUAL"
    PRESENCIAL = "PRESENCIAL"
    HIBRIDO = "HIBRIDO"


class EstadoInscripcion(StrEnum):
    """Estado de una inscripción, que **no** es el estado de habilitación (D9)."""

    ACTIVA = "ACTIVA"
    EN_ESPERA = "EN_ESPERA"
    BAJA = "BAJA"
    COMPLETADA = "COMPLETADA"


class CategoriaInscripcion(StrEnum):
    """Categoría arancelaria (historias #14 y #15)."""

    PARTICULAR = "PARTICULAR"
    BECADO_PARCIAL = "BECADO_PARCIAL"
    BECADO_TOTAL = "BECADO_TOTAL"
    CORPORATIVO = "CORPORATIVO"


class TipoDocumento(StrEnum):
    """Tipo de documento del padrón de alumnos.

    `D30`: el padrón admite alumnos sin DNI porque el instituto inscribe alumnos del
    exterior. La historia #47 (Won't) completa el alcance cuando el cliente defina
    los datos que exige un extranjero.
    """

    DNI = "DNI"
    PASAPORTE = "PASAPORTE"


class Rol(StrEnum):
    """Los tres roles del sistema (D3). Administración y Secretaría son el mismo."""

    ADMIN = "ADMIN"
    DOCENTE = "DOCENTE"
    ALUMNO = "ALUMNO"


class TipoContrato(StrEnum):
    """Tipo de contrato corporativo (historia #19)."""

    CHARLA = "CHARLA"
    CURSO_FORMAL = "CURSO_FORMAL"


class EstadoContrato(StrEnum):
    """Estado del contrato corporativo.

    `design.md` deja abierta la pregunta de si el estado es enum o una tabla con
    transiciones auditadas. Se modela como enum simple, que es la alternativa que el
    propio diseño señala como suficiente; la tabla de transiciones aparece si el
    cliente la necesita.
    """

    ACTIVO = "ACTIVO"
    FINALIZADO = "FINALIZADO"


class MedioPago(StrEnum):
    """Medio de pago de una cobranza (historias #21 y #22)."""

    TRANSFERENCIA = "TRANSFERENCIA"
    EFECTIVO = "EFECTIVO"
    CHEQUE = "CHEQUE"
    TARJETA = "TARJETA"
    BILLETERA = "BILLETERA"
    OTRO = "OTRO"


class OrigenCobranza(StrEnum):
    """Origen del registro de la cobranza: carga manual o pasarela."""

    MANUAL = "MANUAL"
    PASARELA = "PASARELA"


class EstadoCobranza(StrEnum):
    """Estados de una cobranza (D12): tres, no dos."""

    ACREDITADO = "ACREDITADO"
    OBSERVADO = "OBSERVADO"
    RECHAZADO = "RECHAZADO"


class TipoFactura(StrEnum):
    """Tipo de factura (D29): se registra la A y la B."""

    A = "A"
    B = "B"


class EstadoAsistencia(StrEnum):
    """Asistencia de un alumno a una clase (historia #34)."""

    PRESENTE = "PRESENTE"
    AUSENTE = "AUSENTE"


class EstadoHabilitacion(StrEnum):
    """Resultado derivado o forzado del estado de habilitación.

    **Este enum no se persiste en `inscripcion`**: el estado se deriva y solo el
    override lo fuerza (D9).
    """

    HABILITADO = "HABILITADO"
    BLOQUEADO = "BLOQUEADO"


def enum_check(column_name: str, enum_cls: type[StrEnum], rule: str) -> CheckConstraint:
    """Arma el CHECK `columna IN (...)` a partir de los miembros del enum.

    Tener una sola fuente de verdad evita que el enum y el CHECK se desincronicen.
    """
    values = ", ".join(f"'{member.value}'" for member in enum_cls)
    return CheckConstraint(f"{column_name} IN ({values})", name=rule)
