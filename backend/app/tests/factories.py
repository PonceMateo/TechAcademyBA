"""Constructores de registros válidos para las pruebas.

Cada helper arma una fila que cumple todas las restricciones del esquema, para que un
test que busca rechaza **una sola** cosa sepa exactamente cuál está probando. Un
`assert` sobre el motivo de PostgreSQL acompaña cada rechazo, así el test falla si
PostgreSQL.ok.

**Ningún constructor recibe el código de un curso ni el de una comisión.** Los dos los
genera el sistema (D32 y D34): `curso.codigo` es una columna generada por la base y
`comision.codigo` es una propiedad compuesta a partir del curso y del número. Una fábrica
que los aceptara estaría escribiendo algo que el `INSERT` real no puede escribir, y los
tests pasarían sobre un camino que la aplicación no tiene.

Documentos y CUIT de ejemplo: los dígitos verificadores están calculados con la regla
de AFIP (pesos 5, 4, 3, 2, 7, 6, 5, 4, 3, 2; `dv = 11 - (suma mod 11)`, con 11 → 0 y
10 → 9). Por ejemplo `30-12345678-1` cierra con 1, y `20-12345678-6` con 6.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import crear_token_acceso, hashear_password
from app.models.catalogo import Comision, Curso, Sede
from app.models.clases import Asistencia, Clase, OverrideHabilitacion
from app.models.cobranza import Cobranza, Factura, Imputacion, Pagador
from app.models.enums import (
    CategoriaInscripcion,
    EstadoAsistencia,
    EstadoCobranza,
    EstadoContrato,
    EstadoHabilitacion,
    EstadoInscripcion,
    MedioPago,
    Modalidad,
    Rol,
    TipoContrato,
    TipoDocumento,
    TipoFactura,
)
from app.models.inscripciones import ContratoCorporativo, Empresa, Inscripcion, NominaEmpleado
from app.models.padron import Alumno, Docente, Usuario
from app.services.normalization import normalize_document, normalize_name

#: Contraseña de las cuentas que arman las fábricas. Las pruebas de autenticación la usan
#: para comprobar que el login acepta lo que corresponde y rechaza lo demás.
PASSWORD_DE_PRUEBA = "Prueba1234!"

#: Pesos de la regla de dígito verificador de CUIT/CUIL de AFIP.
_CUIT_PESOS = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def cuit_digito_verificador(primeros_diez: str) -> str:
    """Calcula el dígito verificador de un CUIT a partir de sus diez primeros dígitos."""
    total = sum(int(digito) * peso for digito, peso in zip(primeros_diez, _CUIT_PESOS, strict=True))
    resto = total % 11
    if resto == 0:
        return "0"
    if resto == 1:
        return "9"
    return str(11 - resto)


def cuit_valido(primeros_diez: str = "3012345678") -> str:
    """Devuelve un CUIT de 11 dígitos con el dígito verificador correcto."""
    return f"{primeros_diez}{cuit_digito_verificador(primeros_diez)}"


def _persistir(session: Session, instancia) -> object:
    session.add(instancia)
    session.flush()
    return instancia


def crear_sede(session: Session, nombre: str = "Sede Central") -> Sede:
    return _persistir(session, Sede(nombre=nombre, direccion="Av. Corrientes 800"))


def crear_curso(
    session: Session,
    nombre: str = "Python Inicial",
) -> Curso:
    """Curso válido. El código **no** es un parámetro: lo genera la base (D32).

    Si un test necesita ver el código, lo lee del curso ya insertado, que es lo que hace
    la aplicación.
    """
    return _persistir(
        session,
        Curso(
            nombre=nombre,
            nombre_norm=normalize_name(nombre),
            descripcion="Curso de introducción a Python.",
        ),
    )


def crear_comision(
    session: Session,
    *,
    curso: Curso | None = None,
    sede: Sede | None = None,
    con_sede: bool = True,
    numero: int | None = None,
    cupo_maximo: int = 20,
    arancel: Decimal | str = "52000.00",
    modalidad: str = Modalidad.PRESENCIAL.value,
) -> Comision:
    """Comisión válida por defecto.

    `con_sede=False` existe para el caso de la historia #8 de la sede **opcional**: una
    comisión presencial o híbrida sin sede tiene que persistir con `sede_id` en `None`.

    `numero=None` toma el siguiente del curso, que es la regla de D34 y deja que un test
    pueda crear varias comisiones del mismo curso sin pasar el número a mano. Para probar
    la colisión de `uq_comision_curso_numero` hay que pasar el número explícito.
    """
    sede_efectiva = None
    if con_sede:
        sede_efectiva = sede or crear_sede(session)
    curso_efectivo = curso or crear_curso(session)
    if numero is None:
        mayor = session.scalar(
            select(func.max(Comision.numero)).where(Comision.curso_id == curso_efectivo.id)
        )
        numero = (mayor or 0) + 1
    return _persistir(
        session,
        Comision(
            curso_id=curso_efectivo.id,
            numero=numero,
            dias_horarios="Lunes y miércoles 18:00 a 20:00",
            cupo_maximo=cupo_maximo,
            arancel=Decimal(arancel),
            modalidad=modalidad,
            sede_id=sede_efectiva.id if sede_efectiva else None,
        ),
    )


def crear_docente(
    session: Session,
    *,
    nombre: str = "Rita",
    apellido: str = "Molina",
    dni: str = "30111222",
    cuil: str | None = None,
    email: str = "rita.molina@techacademy.invalid",
) -> Docente:
    """Docente válido. El CUIL es opcional (D33), así que el valor por defecto es `None`.

    El caso de D33 en persona: en esta fase los docentes no son personas reales y no hay
    CUIL que completar.
    """
    return _persistir(
        session,
        Docente(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            dni_norm=normalize_document(dni),
            cuil=cuil,
            email=email,
            telefono="+54 11 4000-0001",
        ),
    )


def crear_alumno(
    session: Session,
    *,
    nombre: str = "Agustina Benítez",
    documento: str | None = "38111222",
    tipo_documento: str | None = TipoDocumento.DNI.value,
    email: str = "agustina.benitez@techacademy.invalid",
) -> Alumno:
    """Alumno del padrón. Con `documento=None` se reproduce el caso D30: el alumno del
    exterior entra con pasaporte y sin DNI."""
    return _persistir(
        session,
        Alumno(
            nombre=nombre,
            documento=documento,
            documento_norm=normalize_document(documento),
            tipo_documento=tipo_documento,
            email=email,
            telefono="+54 11 4000-0002",
        ),
    )


def crear_usuario_admin(
    session: Session,
    *,
    email: str = "admin@techacademy.invalid",
    nombre: str = "Secretaria BA",
    is_active: bool = True,
    must_change_password: bool = False,
) -> Usuario:
    return _persistir(
        session,
        Usuario(
            email=email,
            nombre=nombre,
            password_hash=hashear_password(PASSWORD_DE_PRUEBA),
            rol=Rol.ADMIN.value,
            must_change_password=must_change_password,
            is_active=is_active,
        ),
    )


def crear_usuario_docente(
    session: Session,
    *,
    docente: Docente | None = None,
    email: str = "rita.molina.login@techacademy.invalid",
    is_active: bool = True,
    must_change_password: bool = True,
) -> Usuario:
    docente = docente or crear_docente(session, email="rita.molina@techacademy.invalid")
    return _persistir(
        session,
        Usuario(
            email=email,
            nombre=f"{docente.nombre} {docente.apellido}",
            password_hash=hashear_password(PASSWORD_DE_PRUEBA),
            rol=Rol.DOCENTE.value,
            must_change_password=must_change_password,
            is_active=is_active,
            docente_id=docente.id,
        ),
    )


def crear_usuario_alumno(
    session: Session,
    *,
    alumno: Alumno | None = None,
    email: str = "agustina.benitez.login@techacademy.invalid",
    is_active: bool = True,
    must_change_password: bool = True,
) -> Usuario:
    """Falta en el padrón de pruebas hasta el work unit 5: `ALUMNO` es uno de los tres
    roles y sin esta cuenta no se puede probar la autorización por rol."""
    alumno = alumno or crear_alumno(session, email="agustina.benitez@techacademy.invalid")
    return _persistir(
        session,
        Usuario(
            email=email,
            nombre=alumno.nombre,
            password_hash=hashear_password(PASSWORD_DE_PRUEBA),
            rol=Rol.ALUMNO.value,
            must_change_password=must_change_password,
            is_active=is_active,
            alumno_id=alumno.id,
        ),
    )


def token_de_prueba(usuario: Usuario, **kwargs) -> str:
    """Token firmado para una cuenta ya persistida."""
    return crear_token_acceso(
        usuario_id=usuario.id,
        rol=usuario.rol,
        email=usuario.email,
        **kwargs,
    )


def encabezado_de_autorizacion(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def crear_empresa(
    session: Session,
    *,
    razon_social: str = "Tech Solutions S.A.",
    cuit: str | None = None,
    requiere_factura_a: bool = True,
) -> Empresa:
    cuit = cuit or cuit_valido("3012345678")
    return _persistir(
        session,
        Empresa(
            razon_social=razon_social,
            cuit=cuit,
            # D6: el índice único va sobre la forma normalizada, así que un CUIT escrito
            # con guiones tiene que colisionar con el mismo CUIT sin guiones.
            cuit_norm=normalize_document(cuit),
            requiere_factura_a=requiere_factura_a,
        ),
    )


def crear_inscripcion(
    session: Session,
    *,
    alumno: Alumno | None = None,
    comision: Comision | None = None,
    categoria: str = CategoriaInscripcion.PARTICULAR.value,
    porcentaje_beca: Decimal | str | None = None,
    empresa_id: int | None = None,
    estado: str = EstadoInscripcion.ACTIVA.value,
) -> Inscripcion:
    return _persistir(
        session,
        Inscripcion(
            alumno_id=(alumno or crear_alumno(session)).id,
            comision_id=(comision or crear_comision(session)).id,
            categoria=categoria,
            porcentaje_beca=Decimal(porcentaje_beca) if porcentaje_beca is not None else None,
            empresa_id=empresa_id,
            estado=estado,
        ),
    )


def crear_contrato(
    session: Session,
    *,
    empresa: Empresa | None = None,
    comision: Comision | None = None,
    tipo: str = TipoContrato.CURSO_FORMAL.value,
    monto: Decimal | str = "500000.00",
) -> ContratoCorporativo:
    return _persistir(
        session,
        ContratoCorporativo(
            empresa_id=(empresa or crear_empresa(session)).id,
            comision_id=(comision or crear_comision(session)).id if comision else None,
            tipo=tipo,
            monto=Decimal(monto),
            estado=EstadoContrato.ACTIVO.value,
        ),
    )


def crear_nomina_empleado(
    session: Session,
    *,
    contrato: ContratoCorporativo,
    alumno: Alumno | None = None,
) -> NominaEmpleado:
    return _persistir(
        session,
        NominaEmpleado(
            contrato_id=contrato.id,
            tipo_contrato=contrato.tipo,
            alumno_id=(alumno or crear_alumno(session)).id,
        ),
    )


def crear_cobranza(
    session: Session,
    *,
    importe: Decimal | str = "100000.00",
    estado: str = EstadoCobranza.ACREDITADO.value,
    causa: str | None = None,
    medio: str = MedioPago.TRANSFERENCIA.value,
    pagador_id: int | None = None,
) -> Cobranza:
    from datetime import date, timedelta

    return _persistir(
        session,
        Cobranza(
            fecha=date.today() - timedelta(days=3),
            importe=Decimal(importe),
            medio=medio,
            estado=estado,
            causa=causa,
            pagador_id=pagador_id,
        ),
    )


def crear_pagador(
    session: Session,
    *,
    nombre: str = "Familiar de Agustina",
    documento: str | None = "27777777",
) -> Pagador:
    return _persistir(
        session,
        Pagador(nombre=nombre, documento=documento, documento_norm=normalize_document(documento)),
    )


def crear_imputacion(
    session: Session,
    *,
    cobranza: Cobranza,
    inscripcion: Inscripcion | None = None,
    empresa_id: int | None = None,
    monto: Decimal | str = "100000.00",
) -> Imputacion:
    return _persistir(
        session,
        Imputacion(
            cobranza_id=cobranza.id,
            inscripcion_id=inscripcion.id if inscripcion else None,
            empresa_id=empresa_id,
            monto=Decimal(monto),
        ),
    )


def crear_clase(
    session: Session,
    *,
    comision: Comision | None = None,
    link_virtual: str | None = None,
) -> Clase:
    from datetime import date, timedelta

    return _persistir(
        session,
        Clase(
            comision_id=(comision or crear_comision(session)).id,
            fecha=date.today() + timedelta(days=7),
            tema="Introducción a variables",
            link_virtual=link_virtual,
        ),
    )


def crear_asistencia(session: Session, *, clase: Clase, alumno: Alumno) -> Asistencia:
    return _persistir(
        session,
        Asistencia(clase_id=clase.id, alumno_id=alumno.id, estado=EstadoAsistencia.PRESENTE.value),
    )


def crear_override(
    session: Session,
    *,
    inscripcion: Inscripcion,
    usuario: Usuario,
    motivo: str = "Ajuste comercial autorizado por dirección",
    estado_forzado: str = EstadoHabilitacion.HABILITADO.value,
    activo: bool = True,
) -> OverrideHabilitacion:
    return _persistir(
        session,
        OverrideHabilitacion(
            inscripcion_id=inscripcion.id,
            estado_forzado=estado_forzado,
            motivo=motivo,
            usuario_id=usuario.id,
            activo=activo,
        ),
    )


def crear_factura(
    session: Session,
    *,
    alumno: Alumno | None = None,
    empresa_id: int | None = None,
    tipo: str = TipoFactura.B.value,
    requerida: bool = True,
    emitida: bool = False,
) -> Factura:
    return _persistir(
        session,
        Factura(
            alumno_id=alumno.id if alumno else None,
            empresa_id=empresa_id,
            tipo=tipo,
            requerida=requerida,
            emitida=emitida,
            numero=None,
        ),
    )
