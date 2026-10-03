"""Unicidad global de email entre los tres padrones (D5).

D5 declara que `usuario.email`, `docente.email` y `alumno.email` son únicos cada uno,
"lo que garantiza unicidad global de email entre los tres padrones". **Eso no es
cierto a nivel de base de datos**: un índice único es por tabla, así que tres índices
únicos no impiden que un mismo correo esté en dos padrones a la vez.

Lo que sí se sostiene sin hacks es esto:

- cada padrón es único contra sí mismo, por índice único en base (PostgreSQL lo
  garantiza aunque nadie pase por acá);
- `usuario.email` es único de forma global, y es la tabla de identidad: una dirección
  identifica a una sola persona;
- la unicidad **cruzada** entre `docente` y `alumno` la verifica esta función, dentro
  de la transacción de alta.

Es una regla de negocio y por eso vive acá y no en la ruta (D1). Si el cliente
confirma que nadie puede ser docente y alumno a la vez, la misma función alcanza y la
base no cambia.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.padron import Alumno, Docente, Usuario


class EmailAlreadyRegistered(Exception):
    """Ya hay una persona con ese correo en otro padrón."""

    def __init__(self, email: str, padrón: str) -> None:
        self.email = email
        self.padrón = padrón
        super().__init__(f"El email {email} ya está registrado en el padrón de {padrón}.")


def find_patron_registrado(
    session: Session,
    email: str,
    *,
    exclude_docente_id: int | None = None,
    exclude_alumno_id: int | None = None,
    exclude_usuario_id: int | None = None,
) -> str | None:
    """Devuelve el padrón que ya tiene ese email, o `None` si está libre.

    Ignora los registros indicados en los `exclude_*`, para que un docente pueda
    guardar su propio perfil sin que su propia fila lo bloquee.
    """
    docente = select(Docente).where(Docente.email == email)
    if exclude_docente_id is not None:
        docente = docente.where(Docente.id != exclude_docente_id)
    if session.scalars(docente).first() is not None:
        return "docentes"

    alumno = select(Alumno).where(Alumno.email == email)
    if exclude_alumno_id is not None:
        alumno = alumno.where(Alumno.id != exclude_alumno_id)
    if session.scalars(alumno).first() is not None:
        return "alumnos"

    usuario = select(Usuario).where(Usuario.email == email)
    if exclude_usuario_id is not None:
        usuario = usuario.where(Usuario.id != exclude_usuario_id)
    if session.scalars(usuario).first() is not None:
        return "cuentas"

    return None


def ensure_email_available(
    session: Session,
    email: str,
    *,
    exclude_docente_id: int | None = None,
    exclude_alumno_id: int | None = None,
    exclude_usuario_id: int | None = None,
) -> None:
    """Lanza `EmailAlreadyRegistered` si el correo ya está en otro padrón."""
    padrón = find_patron_registrado(
        session,
        email,
        exclude_docente_id=exclude_docente_id,
        exclude_alumno_id=exclude_alumno_id,
        exclude_usuario_id=exclude_usuario_id,
    )
    if padrón is not None:
        raise EmailAlreadyRegistered(email, padrón)
