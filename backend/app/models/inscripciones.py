"""Inscripciones, empresas, contratos corporativos y nóminas (4.3).

D26: la nómina se ancla en el contrato, no en la empresa, porque la misma empresa
puede contratar dos cursos distintos y cada contrato tiene su propia tanda.
D9: `inscripcion` no tiene columna de estado de habilitación; el estado se deriva.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.catalogo import MONEY
from app.models.enums import (
    CategoriaInscripcion,
    EstadoContrato,
    EstadoInscripcion,
    TipoContrato,
    enum_check,
)

if TYPE_CHECKING:
    # Solo para el linter. En tiempo de ejecución, SQLAlchemy resuelve estas relaciones
    # por nombre de clase dentro del registro de `Base.metadata`.
    from app.models.catalogo import Comision
    from app.models.padron import Alumno

# Dígito verificador del CUIT, según la regla de AFIP: los diez primeros dígitos se
# multiplican por 5, 4, 3, 2, 7, 6, 5, 4, 3, 2; se suman; el resto de dividir por 11
# se le resta de 11; y si el resultado es 11 el dígito es 0, si es 10 el dígito es 9.
#
# Se usa `mod()` y no el operador `%` porque Alembic escapa `%` al escribir el CHECK,
# y un `%%` que llega a PostgreSQL es un error de sintaxis.
_CUIT_PESOS = (
    "substr(cuit_norm, 1, 1)::int * 5 + substr(cuit_norm, 2, 1)::int * 4"
    " + substr(cuit_norm, 3, 1)::int * 3 + substr(cuit_norm, 4, 1)::int * 2"
    " + substr(cuit_norm, 5, 1)::int * 7 + substr(cuit_norm, 6, 1)::int * 6"
    " + substr(cuit_norm, 7, 1)::int * 5 + substr(cuit_norm, 8, 1)::int * 4"
    " + substr(cuit_norm, 9, 1)::int * 3 + substr(cuit_norm, 10, 1)::int * 2"
)
_CUIT_CIFRA = (
    f"CASE mod({_CUIT_PESOS}, 11)"
    " WHEN 0 THEN 0"
    " WHEN 1 THEN 9"
    f" ELSE 11 - mod({_CUIT_PESOS}, 11) END"
)
# El CASE exterior es lo que hace que el CHECK sea seguro ante un CUIT mal formado: sin
# él, `substr(cuit_norm, 1, 1)::int` revienta con un error de cast en lugar de rechazar
# la fila por la restricción. PostgreSQL no garantiza el orden de evaluación de los
# operandos de un AND, así que la guarda tiene que ir dentro de la expresión.
_CUIT_DIGITO_SEGURO = (
    f"CASE WHEN cuit_norm ~ '^[0-9]{{11}}$'"
    f" THEN {_CUIT_CIFRA} = substr(cuit_norm, 11, 1)::int"
    " ELSE false END"
)


class Empresa(TimestampMixin, Base):
    """Empresa con cuentas corporativas (historias #18 y #20).

    El CUIT se valida por formato y por dígito verificador. D6: `cuit_norm` solo tiene
    dígitos y es la que tiene el índice único, para que `30-71665544-9` y
    `30716655449` colisionen, que es exactamente el duplicado que tiene la planilla del
    cliente.
    """

    __tablename__ = "empresa"
    __table_args__ = (
        UniqueConstraint("cuit_norm", name="uq_empresa_cuit_norm"),
        CheckConstraint("cuit_norm ~ '^[0-9]{11}$'", name="cuit_formato"),
        CheckConstraint(_CUIT_DIGITO_SEGURO, name="cuit_digito"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    razon_social: Mapped[str] = mapped_column(String(200), nullable=False)
    cuit: Mapped[str] = mapped_column(String(20), nullable=False)
    cuit_norm: Mapped[str] = mapped_column(String(20), nullable=False)
    requiere_factura_a: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class ContratoCorporativo(TimestampMixin, Base):
    """Contrato de una empresa con el instituto (historia #19).

    Una charla cerrada no genera alumnos ni nómina; un curso formal sí. La restricción
    se aplica en base con una clave foránea compuesta contra `nomina_empleado`.

    La clave única `(id, tipo)` no es redundante: es el destino que permite el CHECK de
    "una charla no genera nómina".
    """

    __tablename__ = "contrato_corporativo"
    __table_args__ = (
        enum_check("tipo", TipoContrato, "tipo_contrato_valido"),
        enum_check("estado", EstadoContrato, "estado_contrato_valido"),
        CheckConstraint("monto >= 0", name="contrato_monto_no_negativo"),
        UniqueConstraint("id", "tipo", name="uq_contrato_corporativo_id_tipo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresa.id", ondelete="RESTRICT"), nullable=False
    )
    comision_id: Mapped[int | None] = mapped_column(
        ForeignKey("comision.id", ondelete="RESTRICT"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    monto: Mapped[Decimal] = mapped_column(MONEY, nullable=False, server_default="0")
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=EstadoContrato.ACTIVO.value
    )

    empresa: Mapped[Empresa] = relationship()
    comision: Mapped[Comision] = relationship()


class NominaEmpleado(TimestampMixin, Base):
    """Empleado cargado en la nómina de un contrato de curso formal (historia #19).

    `tipo_contrato` es una columna desnormalizada que existe **para sostener una
    restricción**: la clave foránea compuesta contra `contrato_corporativo(id, tipo)`
    más el CHECK `tipo_contrato = 'CURSO_FORMAL'` impiden que una charla cerrada tenga
    nómina. Sin esto la regla quedaría solo en el servicio y se podría saltar con un
    INSERT directo.
    """

    __tablename__ = "nomina_empleado"
    __table_args__ = (
        UniqueConstraint("contrato_id", "alumno_id", name="uq_nomina_contrato_alumno"),
        CheckConstraint("tipo_contrato = 'CURSO_FORMAL'", name="solo_curso_formal_tiene_nomina"),
        ForeignKeyConstraint(
            ["contrato_id", "tipo_contrato"],
            ["contrato_corporativo.id", "contrato_corporativo.tipo"],
            name="fk_nomina_empleado_contrato_id_tipo_contrato_corporativo",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    contrato_id: Mapped[int] = mapped_column(nullable=False)
    tipo_contrato: Mapped[str] = mapped_column(String(20), nullable=False)
    alumno_id: Mapped[int] = mapped_column(
        ForeignKey("alumno.id", ondelete="RESTRICT"), nullable=False
    )

    alumno: Mapped[Alumno] = relationship()


class Inscripcion(TimestampMixin, Base):
    """Inscripción de un alumno en una comisión (historias #14 y #15).

    D9: **no hay columna de estado de habilitación**. Lo que se guarda, cuando hay, es
    el override en `override_habilitacion`.
    """

    __tablename__ = "inscripcion"
    __table_args__ = (
        UniqueConstraint("alumno_id", "comision_id", name="uq_inscripcion_alumno_comision"),
        enum_check("categoria", CategoriaInscripcion, "categoria_valida"),
        enum_check("estado", EstadoInscripcion, "estado_inscripcion_valido"),
        # Historia #15: el porcentaje solo existe para la beca parcial y va de 1 a 99.
        CheckConstraint(
            "(categoria = 'BECADO_PARCIAL' AND porcentaje_beca IS NOT NULL"
            " AND porcentaje_beca BETWEEN 1 AND 99)"
            " OR (categoria <> 'BECADO_PARCIAL' AND porcentaje_beca IS NULL)",
            name="porcentaje_beca_solo_para_becado_parcial",
        ),
        # Historia #14: la categoría Corporativo exige empresa.
        CheckConstraint(
            "categoria <> 'CORPORATIVO' OR empresa_id IS NOT NULL",
            name="corporativo_requiere_empresa",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alumno_id: Mapped[int] = mapped_column(
        ForeignKey("alumno.id", ondelete="RESTRICT"), nullable=False
    )
    comision_id: Mapped[int] = mapped_column(
        ForeignKey("comision.id", ondelete="RESTRICT"), nullable=False
    )
    categoria: Mapped[str] = mapped_column(String(20), nullable=False)
    porcentaje_beca: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresa.id", ondelete="RESTRICT"), nullable=True
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=EstadoInscripcion.ACTIVA.value
    )

    alumno: Mapped[Alumno] = relationship()
    comision: Mapped[Comision] = relationship()
    empresa: Mapped[Empresa] = relationship()
