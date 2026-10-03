import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AccessPage } from './admin/AccessPage'
import { AdminLayout } from './admin/AdminLayout'
import { CoursesPage } from './admin/CoursesPage'
import { DashboardPage } from './admin/DashboardPage'
import { PaymentsPage } from './admin/PaymentsPage'
import { StudentsPage } from './admin/StudentsPage'
import { TeachersPage } from './admin/TeachersPage'
import { RequireRole } from './auth/RequireRole'
import { FORBIDDEN_PATH, LOGIN_PATH, homePathForRole } from './auth/roleRoutes'
import { SESSION_STATUS, SessionProvider, useSession } from './auth/SessionContext'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { LandingPage } from './pages/LandingPage'
import { LoadingPage } from './pages/LoadingPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

/**
 * Raíz del sitio: a la sección del rol que está entrando, o al login (7.3).
 *
 * Existe para que ninguna URL sea una pantalla muerta y para que el botón de recargar no
 * devuelva a nadie a un 404.
 */
function RootRedirect() {
  const { status, session } = useSession()

  if (status === SESSION_STATUS.LOADING) {
    return <LoadingPage />
  }

  return <Navigate to={session ? homePathForRole(session.rol) : LOGIN_PATH} replace />
}

/**
 * Tabla de ruteo. Cada sección declara su rol una vez, acá; las pantallas cuelgan debajo de estas
 * tres rutas sin cambiar quién puede verlas (M10).
 *
 * El shell de Administración ya existe y sus seis pantallas cuelgan de `AdminLayout` con rutas
 * hijas: el layout no sabe qué pantalla hay, la dibuja. Los shells de Docente y de Alumno siguen
 * con la pantalla de marcador de posición hasta que lleguen los grupos 10 y 11.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path={LOGIN_PATH} element={<LoginPage />} />
      <Route path={FORBIDDEN_PATH} element={<ForbiddenPage />} />

      <Route
        path="/admin"
        element={
          <RequireRole allowedRoles={['ADMIN']}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="cursos" element={<CoursesPage />} />
        <Route path="docentes" element={<TeachersPage />} />
        <Route path="alumnos" element={<StudentsPage />} />
        <Route path="cobranzas" element={<PaymentsPage />} />
        <Route path="habilitacion" element={<AccessPage />} />
      </Route>

      <Route
        path="/docente"
        element={
          <RequireRole allowedRoles={['DOCENTE']}>
            <LandingPage />
          </RequireRole>
        }
      />
      <Route
        path="/alumno"
        element={
          <RequireRole allowedRoles={['ALUMNO']}>
            <LandingPage />
          </RequireRole>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  )
}
