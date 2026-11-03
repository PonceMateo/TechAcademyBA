import { render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_MODE, configurarFuenteDeDatos, createDataSource } from './dataSourceFactory'
import { createMockDataSource } from './mockDataSource'
import {
  actualizarPerfilAlumno,
  buscarAlumnoReactivable,
  buscarDocentes,
  crearAlumno,
  editarAlumno,
  editarComision,
  editarCurso,
  editarDocente,
  eliminarAlumno,
  listarAlumnos,
  listarComisiones,
  listarCursos,
  obtenerAlumno,
  obtenerPerfilAlumno,
  reactivarAlumno,
  restablecerPasswordAlumno,
  restablecerPasswordDocente,
} from './dataService'

describe('detalle del alumno (HU 64 y 61)', () => {
  it('devuelve una entrada por inscripción con su categoría', async () => {
    const detalle = await obtenerAlumno(1)

    expect(detalle.inscripciones).toHaveLength(2)
    expect(detalle.inscripciones.map((inscripcion) => inscripcion.categoria)).toEqual([
      'PARTICULAR',
      'CORPORATIVO',
    ])
    expect(detalle.inscripciones[1].empresa.razon_social).toBe('Tech Solutions S.A.')
  })

  it('informa los importes de cada inscripción', async () => {
    const detalle = await obtenerAlumno(1)
    const [particular, corporativa] = detalle.inscripciones

    // Juan pagó el arancel completo de la particular y la corporativa va a cargo de la empresa.
    expect(particular.monto_requerido).toBe(45000)
    expect(particular.total_pagado).toBe(45000)
    expect(particular.saldo_pendiente).toBe(0)
    expect(corporativa.monto_requerido).toBeNull()
    expect(corporativa.saldo_pendiente).toBeNull()
  })

  it('descuenta la beca parcial, exime la beca total e informa lo observado', async () => {
    const [camila] = (await obtenerAlumno(2)).inscripciones
    const [matias] = (await obtenerAlumno(3)).inscripciones
    const [valeria] = (await obtenerAlumno(6)).inscripciones

    expect(camila.monto_requerido).toBe(26000)
    expect(camila.saldo_pendiente).toBe(0)
    expect(matias.monto_requerido).toBe(0)
    expect(matias.saldo_pendiente).toBe(0)
    expect(valeria.total_pagado).toBe(0)
    expect(valeria.total_observado).toBe(26000)
    expect(valeria.saldo_pendiente).toBe(52000)
  })

  it('deja el padrón sin datos de inscripción', async () => {
    const [alumno] = await listarAlumnos()

    expect(alumno).not.toHaveProperty('comision')
    expect(alumno).not.toHaveProperty('categoria')
    expect(alumno).not.toHaveProperty('acceso')
  })
})

/**
 * La frontera de datos (8.2).
 *
 * Lo que se verifica es la promesa de D13 en los dos sentidos: una pantalla pide sus datos por el
 * servicio y no por los mocks, y cambiar de implementación no obliga a tocar esa pantalla. La
 * segunda es la importante: si el probe tuviera que saber de dónde vienen los datos, la frontera
 * no estaría cerrando nada.
 */

const FUENTE_INICIAL = createDataSource({ modo: API_MODE.MOCK })

afterEach(() => {
  configurarFuenteDeDatos(FUENTE_INICIAL)
})

/** Pantalla de prueba: pide comisiones al servicio y dibuja la primera. */
function ComisionesProbe() {
  const [comisiones, setComisiones] = useState([])

  useEffect(() => {
    let vigente = true
    listarComisiones().then((resultado) => {
      if (vigente) {
        setComisiones(resultado)
      }
    })
    return () => {
      vigente = false
    }
  }, [])

  return <p>Cantidad: {comisiones.length}</p>
}

describe('resolución de la implementación', () => {
  it('rechaza un modo sin implementación con un mensaje que dice cuáles hay', () => {
    expect(() => createDataSource({ modo: 'graphql' })).toThrow(/No hay implementación/)
  })

  it('devuelve una fuente distinta en cada creación, para que una no contamine a la otra', () => {
    const primera = createMockDataSource()
    const segunda = createMockDataSource()

    expect(primera).not.toBe(segunda)
  })
})

describe('la pantalla pide sus datos por el servicio', () => {
  it('muestra lo que devuelve la implementación configurada', async () => {
    render(<ComisionesProbe />)

    await waitFor(() => expect(screen.getByText('Cantidad: 5')).toBeInTheDocument())
  })

  it('no cambia cuando cambia la implementación detrás del mismo servicio', async () => {
    const fuenteFalsa = {
      modo: 'api',
      listarComisiones: async () => [{ codigo: 'CUR-999' }],
    }
    configurarFuenteDeDatos(fuenteFalsa)

    // El mismo componente, sin tocarlo: solo se cambió quién responde.
    render(<ComisionesProbe />)

    await waitFor(() => expect(screen.getByText('Cantidad: 1')).toBeInTheDocument())
  })
})

describe('la implementación de ejemplo', () => {
  it('devuelve las comisiones con las vacantes ya calculadas', async () => {
    const comisiones = await listarComisiones()

    expect(comisiones.map((comision) => comision.codigo)).toEqual([
      'CUR-101',
      'CUR-104',
      'CUR-108',
      'CUR-110',
      'CUR-103',
    ])
    expect(comisiones.find((c) => c.codigo === 'CUR-104').vacantes).toBe(0)
    expect(comisiones.find((c) => c.codigo === 'CUR-101').vacantes).toBe(7)
  })

  it('filtra el padrón de docentes por prefijo de palabra, orden y campo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    expect((await buscarDocentes('santi')).map((d) => d.id)).toEqual([3])
    expect((await buscarDocentes('martin')).map((d) => d.id)).toEqual([1])
    expect((await buscarDocentes('30.665')).map((d) => d.id)).toEqual([5])
    expect((await buscarDocentes('profemartin')).map((d) => d.id)).toEqual([1])
    expect((await buscarDocentes('rios')).map((d) => d.id)).toEqual([4])
    expect((await buscarDocentes('RÍOS')).map((d) => d.id)).toEqual([4])
    expect(await buscarDocentes('no existe')).toHaveLength(0)

    // Una sola letra busca al comienzo de una palabra, no en el medio.
    expect((await buscarDocentes('a')).map((d) => d.id)).toEqual([3])

    // Las palabras conservan su orden.
    expect((await buscarDocentes('santi ads')).map((d) => d.id)).toEqual([3])
    expect(await buscarDocentes('ads santi')).toHaveLength(0)

    // El DNI también se busca por prefijo, no por cualquier fragmento.
    expect(await buscarDocentes('665')).toHaveLength(0)
  })

  it('devuelve las comisiones reales del ejemplo y su conte derivado', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const [santi] = await buscarDocentes('santi')
    expect(santi.comisiones).toEqual([
      { id: 5, codigo: 'CUR-103', nombre: 'Marketing Digital & Ads' },
    ])
    expect(santi.comisiones_asignadas).toBe(1)

    const [laura] = await buscarDocentes('laura')
    expect(laura.comisiones).toEqual([])
    expect(laura.comisiones_asignadas).toBe(0)
  })

  it('agrega el alumno dado de alta al padrón de ejemplo, sin inscripción', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const creado = await crearAlumno({
      documento: '30.111.222',
      nombre: 'Rocío Álvarez',
      email: 'rocio.alvarez@techacademy.invalid',
      telefono: null,
    })

    expect(creado).toMatchObject({
      nombre: 'Rocío Álvarez',
      documento: '30.111.222',
      tipo_documento: 'DNI',
      comision: null,
      categoria: null,
      porcentaje_beca: null,
      acceso: null,
      password_inicial: 'rocio30111222',
    })
    expect((await listarAlumnos()).map((alumno) => alumno.nombre)).toContain('Rocío Álvarez')
  })

  it('edita un docente y restablece su contraseña sin perder sus comisiones', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const editado = await editarDocente(1, {
      nombre: 'Martín',
      apellido: 'Pérez',
      dni: '28.114.402',
      email: 'martin.perez@techacademy.invalid',
      telefono: null,
    })
    expect(editado).toMatchObject({
      id: 1,
      nombre: 'Martín Pérez',
      nombres: 'Martín',
      apellido: 'Pérez',
      email: 'martin.perez@techacademy.invalid',
    })
    expect(editado.comisiones).toHaveLength(1)

    await expect(restablecerPasswordDocente(1, 'corta')).rejects.toThrow('al menos 8')
    await expect(
      editarDocente(1, {
        nombre: 'Martín',
        apellido: 'Pérez',
        dni: '31.902.118',
        email: 'martin.perez@techacademy.invalid',
        telefono: null,
      }),
    ).rejects.toThrow('DNI')
  })

  it('edita, restablece la contraseña y da de baja en el padrón de ejemplo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const editado = await editarAlumno(1, {
      documento: '38.456.789',
      nombre: 'Juan Pérez Editado',
      email: 'juan.editado@techacademy.invalid',
      telefono: null,
    })
    expect(editado).toMatchObject({ id: 1, nombre: 'Juan Pérez Editado' })

    await restablecerPasswordAlumno(1, 'NuevaClave2026')
    const dadoDeBaja = await eliminarAlumno(1)
    expect(dadoDeBaja.activo).toBe(false)

    const restantes = await listarAlumnos()
    expect(restantes.map((alumno) => alumno.id)).not.toContain(1)
    expect(restantes).toHaveLength(5)
  })

  it('reactiva el mismo alumno dado de baja y le renueva la contraseña inicial', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    await eliminarAlumno(1)
    const reactivable = await buscarAlumnoReactivable({
      documento: '38.456.789',
      email: 'juan.perez@gmail.com',
    })
    expect(reactivable).toMatchObject({ id: 1, activo: false })

    const reactivado = await reactivarAlumno(1, {
      documento: '38.456.789',
      nombre: 'Juan Ignacio Pérez',
      email: 'juan.perez@gmail.com',
      telefono: null,
    })
    expect(reactivado).toMatchObject({
      id: 1,
      activo: true,
      password_inicial: 'juan38456789',
    })

    const activos = await listarAlumnos()
    expect(activos.map((alumno) => alumno.id)).toContain(1)
    expect(activos).toHaveLength(6)
  })

  it('no ofrece reactivar un alumno que sigue activo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const reactivable = await buscarAlumnoReactivable({
      documento: '38.456.789',
      email: 'juan.perez@gmail.com',
    })

    expect(reactivable).toBeNull()
  })

  it('agrega la cobranza registrada al historial', async () => {
    const fuente = createMockDataSource()
    const antes = await fuente.listarCobranzas()

    await fuente.registrarCobranza({
      fecha: '2026-06-01',
      titular: 'Juan Ignacio Pérez',
      medio: 'EFECTIVO',
      factura_a_solicitada: false,
      importe: 45000,
      estado: 'ACREDITADO',
      alumno_id: 1,
      inscripcion_id: 1,
    })

    const despues = await fuente.listarCobranzas()
    expect(despues).toHaveLength(antes.length + 1)
    expect(despues[0].fecha).toBe('2026-06-01')
    expect(despues[0].imputacion.nombre).toBe('Juan Ignacio Pérez')
    // HU 21: sin solicitud no se inventa una Factura B.
    expect(despues[0].factura).toBeNull()
    expect(despues[0].factura_a_solicitada).toBe(false)
  })

  it('deja la causa vacía cuando el cobro queda acreditado', async () => {
    const fuente = createMockDataSource()

    const cobranza = await fuente.registrarCobranza({
      fecha: '2026-06-02',
      titular: 'Alguien',
      medio: 'CHEQUE',
      factura_a_solicitada: true,
      cuit_titular: '30-12345678-1',
      importe: 1000,
      estado: 'ACREDITADO',
      alumno_id: 1,
      inscripcion_id: 1,
    })

    expect(cobranza.causa).toBeNull()
    expect(cobranza.factura).toBe('A')
  })

  it('busca en el historial por coincidencia parcial del titular', async () => {
    const fuente = createMockDataSource()

    const coincidencias = await fuente.listarCobranzas('rodríguez')
    expect(coincidencias.length).toBeGreaterThan(0)
    expect(
      coincidencias.every((fila) => fila.pagador.nombre.toLowerCase().includes('rodríguez')),
    ).toBe(true)

    expect(await fuente.listarCobranzas('nadie con ese nombre')).toHaveLength(0)
  })

  it('devuelve las inscripciones activas del alumno con su categoría (HU 64)', async () => {
    const fuente = createMockDataSource()

    const inscripciones = await fuente.listarInscripcionesDeAlumno(1)
    expect(inscripciones).toHaveLength(2)
    expect(inscripciones[0].estado).toBe('ACTIVA')
    expect(inscripciones[0].comision.codigo).toBe('CUR-101')
    expect(inscripciones[0].categoria).toBe('PARTICULAR')
    expect(inscripciones[1].categoria).toBe('CORPORATIVO')
  })

  it('exige motivo para forzar un bloqueo y anota el usuario con la fecha', async () => {
    const fuente = createMockDataSource()

    await expect(
      fuente.forzarBloqueoManual({ alumnoId: 1, motivo: '   ', usuario: 'Secretaria BA' }),
    ).rejects.toThrow(/motivo es obligatorio/)

    const alumno = await fuente.forzarBloqueoManual({
      alumnoId: 1,
      motivo: 'Revisión de comprobante',
      usuario: 'Secretaria BA',
      fechaOperacion: '2026-06-01',
    })

    expect(alumno.acceso.estado).toBe('BLOQUEADO')
    expect(alumno.acceso.causa).toBe('Revisión de comprobante')
    expect(alumno.acceso.forzado).toEqual({
      usuario: 'Secretaria BA',
      fecha_operacion: '2026-06-01',
      motivo: 'Revisión de comprobante',
    })
  })

  it('copia solo los correos de los alumnos habilitados de la comisión', async () => {
    const fuente = createMockDataSource()

    // CUR-101 tiene a Juan Ignacio Pérez (habilitado) y a Agustina Benítez (bloqueado).
    expect(await fuente.listarEmailsHabilitados('CUR-101')).toEqual(['juan.perez@gmail.com'])
    expect(await fuente.listarEmailsHabilitados('CUR-999')).toEqual([])
  })

})

describe('la edición de curso', () => {
  it('delega en la fuente configurada', async () => {
    const editar = vi.fn(async () => ({ id: 1, nombre: 'Python Inicial Editado' }))
    configurarFuenteDeDatos({ modo: 'api', editarCurso: editar })

    await editarCurso(1, { nombre: 'Python Inicial Editado', descripcion: null })

    expect(editar).toHaveBeenCalledWith(1, {
      nombre: 'Python Inicial Editado',
      descripcion: null,
    })
  })

  it('actualiza el curso y el nombre anidado de sus comisiones en el ejemplo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const actualizado = await editarCurso(1, {
      nombre: 'Python Inicial Editado',
      descripcion: 'Descripción nueva.',
    })

    expect(actualizado).toMatchObject({
      id: 1,
      codigo: 'CUR-101',
      nombre: 'Python Inicial Editado',
      descripcion: 'Descripción nueva.',
    })
    expect((await listarCursos()).find((curso) => curso.id === 1).nombre).toBe(
      'Python Inicial Editado',
    )
    expect(
      (await listarComisiones()).find((comision) => comision.codigo === 'CUR-101').curso.nombre,
    ).toBe('Python Inicial Editado')
  })

  it('rechaza un nombre que ya pertenece a otro curso', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    await expect(
      editarCurso(1, { nombre: 'Diseño UX/UI Avanzado', descripcion: null }),
    ).rejects.toThrow('Ya existe un curso con ese nombre')
  })
})

describe('la edición de docente', () => {
  const DATOS = {
    nombre: 'Ada',
    apellido: 'Lovelace',
    dni: '30.111.222',
    email: 'ada.lovelace@techacademy.invalid',
    telefono: null,
  }

  it('delega en la fuente configurada', async () => {
    const editar = vi.fn(async () => ({ id: 1 }))
    const restablecer = vi.fn(async () => ({ id: 1 }))
    configurarFuenteDeDatos({
      modo: 'api',
      editarDocente: editar,
      restablecerPasswordDocente: restablecer,
    })

    await editarDocente(1, DATOS)
    await restablecerPasswordDocente(1, 'NuevaClave2026')

    expect(editar).toHaveBeenCalledWith(1, DATOS)
    expect(restablecer).toHaveBeenCalledWith(1, 'NuevaClave2026')
  })
})

describe('la edición de comisión', () => {
  const DATOS = {
    docente_id: 1,
    dias_horarios: 'Mar y Jue 19 a 21 hs',
    arancel: 50000,
    cupo_maximo: 25,
  }

  it('delega en la fuente configurada', async () => {
    const editar = vi.fn(async () => ({ id: 4 }))
    configurarFuenteDeDatos({ modo: 'api', editarComision: editar })

    await editarComision(4, DATOS)

    expect(editar).toHaveBeenCalledWith(4, DATOS)
  })

  it('actualiza la comisión en el ejemplo y recalcula las vacantes', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const actualizada = await editarComision(1, DATOS)

    expect(actualizada).toMatchObject({
      id: 1,
      codigo: 'CUR-101',
      cupo_maximo: 25,
      vacantes: 2,
    })
    expect((await listarComisiones()).find((comision) => comision.id === 1).cupo_maximo).toBe(25)
  })

  it('rechaza un cupo por debajo de los inscriptos en el ejemplo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    await expect(editarComision(1, { ...DATOS, cupo_maximo: 10 })).rejects.toThrow(
      '23 inscriptos activos',
    )
  })
})

describe('el autoservicio del alumno en la frontera de datos', () => {
  it('el servicio devuelve lo que entrega la fuente, sin transformar el contrato', async () => {
    const guardado = {
      nombre: 'Agustina Benítez',
      documento: '38111222',
      email: 'agustina@nuevomail.com',
      telefono: null,
    }
    configurarFuenteDeDatos({ actualizarPerfilAlumno: async () => guardado })

    await expect(
      actualizarPerfilAlumno({ email: 'agustina@nuevomail.com', telefono: null }),
    ).resolves.toEqual(guardado)
  })

  it('propaga el conflicto de email en lugar de confirmar un guardado que no pasó', async () => {
    configurarFuenteDeDatos({
      actualizarPerfilAlumno: async () => {
        throw new Error('El email agustina@mail.com ya está registrado en el padrón de alumnos.')
      },
    })

    await expect(
      actualizarPerfilAlumno({ email: 'agustina@mail.com', telefono: null }),
    ).rejects.toThrow(/ya está registrado/)
  })
})

describe('el perfil del alumno contra el ejemplo', () => {
  it('guarda el teléfono en el ejemplo y lo devuelve en el perfil', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    const guardado = await actualizarPerfilAlumno({
      email: (await obtenerPerfilAlumno()).email,
      telefono: '+5491140000009',
    })

    expect(guardado.telefono).toBe('+5491140000009')
    expect((await obtenerPerfilAlumno()).telefono).toBe('+5491140000009')
  })

  it('rechaza un email que ya es de otro alumno del ejemplo', async () => {
    configurarFuenteDeDatos(createMockDataSource())

    await expect(
      actualizarPerfilAlumno({ email: 'juan.perez@gmail.com', telefono: null }),
    ).rejects.toThrow('ya está registrado en el padrón de alumnos')
  })
})
