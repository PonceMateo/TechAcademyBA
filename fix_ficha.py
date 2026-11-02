with open('frontend/src/admin/FichaAlumnoModal.jsx','r',encoding='utf-8') as f: c=f.read()
old_block = '''  return (
    <Modal abierto titulo="Ficha del alumno" onClose={onClose} cerrarAlClickAfuera acciones={
      <div className="relative"><button type="button" aria-label="Acciones del alumno" aria-haspopup="menu" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(a => !a)} className="foco-acento rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">⋮</button>{menuAbierto && (<div role="menu" className="absolute right-0 z-30 mt-1 min-w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"><button type="button" role="menuitem" onClick={() => elegirAccion(onEditar)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Editar</button><button type="button" role="menuitem" onClick={() => elegirAccion(onRestablecerPassword)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Restablecer contraseña</button><button type="button" role="menuitem" onClick={() => elegirAccion(onEliminar)} className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Eliminar</button></div>)}></div>
    }>
      <div className="space-y-4">'''
new_block = '''  const accionesMenu = (
    <div className="relative"><button type="button" aria-label="Acciones del alumno" aria-haspopup="menu" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(a => !a)} className="foco-acento rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">⋮</button>{menuAbierto && (<div role="menu" className="absolute right-0 z-30 mt-1 min-w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"><button type="button" role="menuitem" onClick={() => elegirAccion(onEditar)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Editar</button><button type="button" role="menuitem" onClick={() => elegirAccion(onRestablecerPassword)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Restablecer contraseña</button><button type="button" role="menuitem" onClick={() => elegirAccion(onEliminar)} className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Eliminar</button></div>)}></div>
  )

  return (
    <Modal abierto titulo="Ficha del alumno" onClose={onClose} cerrarAlClickAfuera acciones={accionesMenu}>
      <div className="space-y-4">'''
if old_block not in c: print('NOT FOUND'); exit(1)
c = c.replace(old_block, new_block)
with open('frontend/src/admin/FichaAlumnoModal.jsx','w',encoding='utf-8') as f: f.write(c)
print('ok')
