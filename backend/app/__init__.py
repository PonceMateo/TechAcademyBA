"""Backend de TechAcademy BA.

Estructura por capas (D1): `core` (configuración), `models` (SQLAlchemy),
`schemas` (Pydantic), `api` (rutas) y `services` (reglas de negocio). La lógica de
negocio vive en `services`, nunca en las rutas.
"""

__version__ = "0.1.0"
