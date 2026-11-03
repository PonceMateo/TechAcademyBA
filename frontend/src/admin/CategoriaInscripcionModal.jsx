import { useState } from 'react'
import { Button, Input, Modal } from '../components/ui'
import { actualizarCategoriaInscripcion } from '../services/dataService'

/**
 * Formulario de categoría arancelaria de una inscripción (HU 15, 60 y 64).
 *
 * **La categoría es de la inscripción, no del alumno.** El formulario recibe la inscripción
 * elegida, precarga su categoría, su porcentaje y su empresa, y guarda con el `PATCH` existente;
 * las demás inscripciones del mismo alumno no se tocan. Lo usan la ficha del padrón y la gestión
 * de una comisión, así que no hay dos versiones de la misma regla.
 */
export function CategoriaInscripcionModal({ inscripcion, empresas = [], onClose, onGuardado }) {
  // Se monta al elegir la inscripción, así que la categoría actual llega como estado inicial.
  const [categoria, setCategoria] = useState(inscripcion.categoria)
  const [porcentaje, setPorcentaje] = useState(inscripcion.porcentaje_beca ?? '')
  const empresaId = inscripcion.empresa?.id ?? inscripcion.empresa_id
  const [empresa, setEmpresa] = useState(empresaId == null ? '' : String(empresaId))
  const [fallo, setFallo] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    setFallo(null)
    try {
      await actualizarCategoriaInscripcion(inscripcion.id, {
        categoria,
        porcentaje_beca:
          categoria === 'BECADO_PARCIAL' && porcentaje !== '' ? Number(porcentaje) : null,
        empresa_id: categoria === 'CORPORATIVO' && empresa !== '' ? Number(empresa) : null,
      })
      onGuardado()
    } catch (error) {
      setFallo(error?.message ?? 'No se pudo actualizar la categoría.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      titulo="Asignar categoría"
      onClose={onClose}
      pie={
        <>
          <Button variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-sm text-slate-700">
          {`${inscripcion.comision.codigo} ${inscripcion.comision.nombre}`}
        </p>
        <label className="text-sm text-slate-700">
          Categoría
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
          >
            <option value="PARTICULAR">Particular</option>
            <option value="BECADO_PARCIAL">Becado parcial</option>
            <option value="BECADO_TOTAL">Becado total</option>
            <option value="CORPORATIVO">Corporativo</option>
          </select>
        </label>

        {categoria === 'BECADO_PARCIAL' && (
          <Input
            id="porcentaje-categoria"
            etiqueta="Porcentaje de descuento"
            type="number"
            valor={porcentaje}
            onChange={(evento) => setPorcentaje(evento.target.value)}
          />
        )}

        {categoria === 'CORPORATIVO' && (
          <label className="text-sm text-slate-700">
            Empresa
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={empresa}
              onChange={(evento) => setEmpresa(evento.target.value)}
            >
              <option value="">Seleccionar…</option>
              {empresas.map((candidata) => (
                <option key={candidata.id} value={String(candidata.id)}>
                  {candidata.razon_social}
                </option>
              ))}
            </select>
          </label>
        )}

        {fallo !== null && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fallo}
          </p>
        )}
      </div>
    </Modal>
  )
}
