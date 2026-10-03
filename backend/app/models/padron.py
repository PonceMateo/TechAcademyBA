"""Padrón: docentes, alumnos y cuentas de usuario (4.2).

D4: `Usuario` es la identidad única, con dos vínculos opcionales y un CHECK que valida
la correspondencia entre rol y vínculo.
D5: el email es único en cada padrón, y el documento es único **dentro** de su padrón.
D27: el CUIL del docente es obligatorio y único.
D30: el alumno puede no tener DNI, porque el instituto inscribe alumnos del exterior.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, no_vacio
from app.models.enums import Rol, TipoDocumento, enum_check


class Docente(TimestampMixin, Base):
    """Docente del padrón (historias #9, #10 y #11).

    D27: `cuil` es obligatorio. Es el identificador que el instituto usa para las
    liquidaciones, así que un docente sin CUIL no existe en el sistema. No se valida
    el dígito verificador: el equipo no lo pidió (decisión pendiente P7).
    """

    __tablename__ = "docente"
    __table_args__ = (
        UniqueConstraint("dni_norm", name="uq_docente_dni_norm"),
        UniqueConstraint("cuil", name="uq_docente_cuil"),
        UniqueConstraint("email", name="uq_docente_email"),
        # D27: obligatorio de verdad. `NOT NULL` no alcanza: un CUIL vacío no identifica a
        # nadie para liquidar.
        no_vacio("cuil", "docente_cuil_obligatorio"),
        no_vacio("email", "docente_email_obligatorio"),
        no_vacio("nombre", "docente_nombre_obligatorio"),
        no_vacio("apellido", "docente_apellido_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    apellido: Mapped[str] = mapped_column(String(80), nullable=False)
    dni: Mapped[str] = mapped_column(String(20), nullable=False)
    dni_norm: Mapped[str] = mapped_column(String(20), nullable=False)
    cuil: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(40))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class Alumno(TimestampMixin, Base):
    """Alumno del padrón (historias #13, #16 y #17).

    D30: `documento` puede ser nulo. Cuando el alumno es del exterior, el documento es
    el pasaporte y el DNI no existe. Varios alumnos sin documento pueden convivir
    porque un índice único en PostgreSQL admite múltiples nulos.
    """

    __tablename__ = "alumno"
    __table_args__ = (
        UniqueConstraint("documento_norm", name="uq_alumno_documento_norm"),
        UniqueConstraint("email", name="uq_alumno_email"),
        enum_check("tipo_documento", TipoDocumento, "tipo_documento_valido"),
        # El tipo de documento y el documento van juntos: un número sin decir de qué
        # tipo es no significa nada, y un tipo sin número no identifica a nadie.
        CheckConstraint(
            "(documento IS NULL) = (tipo_documento IS NULL)",
            name="documento_y_tipo_juntos",
        ),
        no_vacio("nombre", "alumno_nombre_obligatorio"),
        no_vacio("email", "alumno_email_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    documento: Mapped[str | None] = mapped_column(String(20))
    documento_norm: Mapped[str | None] = mapped_column(String(20))
    tipo_documento: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(40))
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class Usuario(TimestampMixin, Base):
    """Identidad única de acceso (D4).

    El login es por email, así que `email` es único de forma global: por eso la
    unicidad de email entre los tres padrones se apoya en esta tabla. Los vínculos con
    `docente` y `alumno` son nulos y su correspondencia con el rol la valida el CHECK.
    """

    __tablename__ = "usuario"
    __table_args__ = (
        UniqueConstraint("email", name="uq_usuario_email"),
        enum_check("rol", Rol, "rol_valido"),
        CheckConstraint(
            "(rol = 'ADMIN' AND docente_id IS NULL AND alumno_id IS NULL)"
            " OR (rol = 'DOCENTE' AND docente_id IS NOT NULL AND alumno_id IS NULL)"
            " OR (rol = 'ALUMNO' AND docente_id IS NULL AND alumno_id IS NOT NULL)",
            name="rol_vinculo_coherente",
        ),
        no_vacio("email", "usuario_email_obligatorio"),
        no_vacio("nombre", "usuario_nombre_obligatorio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    docente_id: Mapped[int | None] = mapped_column(
        ForeignKey("docente.id", ondelete="CASCADE"), nullable=True
    )
    alumno_id: Mapped[int | None] = mapped_column(
        ForeignKey("alumno.id", ondelete="CASCADE"), nullable=True
    )

    docente: Mapped[Docente] = relationship()
    alumno: Mapped[Alumno] = relationship()
