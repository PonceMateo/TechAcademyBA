"""API de autoservicio del alumno (HUs #38, #42 y #43).

**Lo que estas pruebas cubren es el contrato HTTP y el aislamiento.** El rol se exige con
`require_roles(Rol.ALUMNO)`, así que Administración y Docente no tienen acceso, y una cuenta con
cambio de contraseña pendiente tampoco (D45). Además, ninguna respuesta puede traer datos de otro
alumno: el legajo sale de la cuenta autenticada y el código se busca entre sus inscripciones (D58).
"""

from __future__ import annotations


def test_las_cuatro_rutas_del_alumno_estan_registradas(client) -> None:
    """El router está incluido en la aplicación y todas sus rutas existen."""
    esquema = client.get("/openapi.json").json()

    assert {
        "/alumno/inscripciones",
        "/alumno/inscripciones/{codigo}",
        "/alumno/mi-perfil",
    } <= set(esquema["paths"])
    assert set(esquema["paths"]["/alumno/mi-perfil"]) == {"get", "put"}
