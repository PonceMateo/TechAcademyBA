"""Contrato de autoservicio del alumno: sus cursadas y sus datos de contacto (HUs #38, #42 y #43).

**El recurso no lleva el identificador del alumno.** El alumno sale de la cuenta autenticada, así
que ningún esquema de este módulo acepta `alumno_id` ni `id`: no hay nada que el cliente pueda
cambiar para pedir los datos de otro (D60).

**La entrada de la edición tiene dos campos y nada más.** `PerfilAlumnoUpdate` es `extra="forbid"`
con `email` y `telefono`, los dos únicos datos que el alumno puede cambiar; el documento, el nombre
y el identificador del sistema son de la secretaría, y mandarlos es un `422` que no llega al
servicio. La unicidad del email no se valida acá —necesita la base— sino en el servicio, con
`ensure_email_available`.

**El teléfono vacío es "no informado".** El campo se guarda en E.164 o nulo, y el formulario manda
`""` cuando el alumno lo borra, así que el esquema lo convierte a `None` antes de validar la forma:
sin esa conversión, borrar el teléfono sería un `422` en lugar de una baja.

Los nombres de los campos van en inglés y el texto de cara al usuario en es-AR, como en el resto de
los contratos (D19).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

from app.schemas.alumnos import AccesoAlumnoOut
from app.schemas.validators import EmailConForma, TelefonoE164


def _vacio_a_none(valor: object) -> object:
    """Convierte el texto vacío —o de solo espacios— en "no informado"."""
    if isinstance(valor, str) and valor.strip() == "":
        return None
    return valor


#: Teléfono opcional donde borrar el dato es mandar vacío o `null`, no un `422`.
TelefonoOpcional = Annotated[TelefonoE164 | None, BeforeValidator(_vacio_a_none)]


class HorarioCursadaOut(BaseModel):
    """Un día de cursada, con la hora en `HH:MM`.

    La hora viaja como texto y no como `time` porque es lo que el frontend agrupa para el resumen
    (`Lun y Mié 19-21hs`): un `time` serializado como `18:00:00` no se puede leer con la misma
    función que el resto del horario.
    """

    model_config = ConfigDict(from_attributes=True)

    dia: str
    inicio: str
    fin: str


class InscripcionAlumnoOut(BaseModel):
    """Una cursada del alumno, para la tarjeta de `Mis Cursos`.

    `docente_nombre` es `None` mientras la comisión no tenga docente asignado: la tarjeta lo
    muestra como «a confirmar» en lugar de inventar una persona. `horario` es el resumen ya
    persistido en la comisión y `horarios` las filas estructuradas, para que la pantalla no tenga
    que parsear el texto.
    """

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre_curso: str
    docente_nombre: str | None = None
    horario: str
    horarios: list[HorarioCursadaOut]
    categoria: str
    porcentaje_beca: Decimal | None = None
    acceso: AccesoAlumnoOut


class ComisionCursadaOut(BaseModel):
    """Los datos de la comisión que muestra el detalle de la cursada."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    docente_nombre: str | None = None
    horario: str
    horarios: list[HorarioCursadaOut]


class CronogramaOut(BaseModel):
    """Período de cursada. Las dos fechas viajan juntas o ninguna.

    Desde la historia #49 `comision` tiene `fecha_inicio` y `fecha_fin` (D62): toda comisión nueva
    las trae y una heredada las trae nulas hasta que alguien la edite. El contrato informa las dos
    juntas o ninguna, y no completa una con una fecha de ejemplo.
    """

    model_config = ConfigDict(from_attributes=True)

    inicio: date | None = None
    fin: date | None = None


class EncuentroOut(BaseModel):
    """Una clase venidera: su fecha, el horario de ese día y el tema cuando ya está cargado.

    `horario` es el rango de ese día de cursada (`18:30-21:30`), sacado de los horarios de la
    comisión: la agenda y el detalle muestran a qué hora se dicta, no solo en qué fecha.
    `tema` es `None` cuando todavía nadie cargó la clase de esa fecha y la fila no completa nada
    en su lugar: no existe un "tema a confirmar", existe un tema que todavía no se cargó.
    **El link de la clase no forma parte de este contrato**: llega con la HU 39.
    """

    model_config = ConfigDict(from_attributes=True)

    fecha: date
    horario: str | None = None
    tema: str | None = None


class DetalleCursadaOut(BaseModel):
    """Detalle de una cursada propia (HU 38 y 42).

    El `404` de una comisión ajena y el de una inexistente son el mismo, así que este esquema solo
    se arma cuando la comisión es una inscripción del alumno que llama.
    """

    model_config = ConfigDict(from_attributes=True)

    comision: ComisionCursadaOut
    categoria: str
    porcentaje_beca: Decimal | None = None
    acceso: AccesoAlumnoOut
    cronograma: CronogramaOut
    proximos_encuentros: list[EncuentroOut]


class PerfilAlumnoOut(BaseModel):
    """Perfil de la cuenta del alumno autenticado (HU 43).

    Solo datos propios: no incluye el identificador del sistema —que no se edita— ni datos de
    terceros pagadores.
    """

    model_config = ConfigDict(from_attributes=True)

    nombre: str
    documento: str | None
    email: str
    telefono: str | None = None


class PerfilAlumnoUpdate(BaseModel):
    """Cuerpo de `PUT /alumno/mi-perfil`: email y teléfono, los dos únicos datos editables.

    `extra="forbid"` es la regla, no una comodidad: un cuerpo con `documento`, `nombre` o `id` se
    rechaza con `422` en el contrato y nunca llega al servicio. El teléfono vacío se guarda como
    no informado.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailConForma = Field(min_length=3, max_length=255)
    telefono: TelefonoOpcional
