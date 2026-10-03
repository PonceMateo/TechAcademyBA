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
import { CourseDetailPage } from './alumno/CourseDetailPage'
import { StudentCoursesPage } from './alumno/StudentCoursesPage'
import { StudentLayout } from './alumno/StudentLayout'
import { StudentPaymentsPage } from './alumno/StudentPaymentsPage'
import { StudentProfilePage } from './alumno/StudentProfilePage'
import { AttendancePage } from './docente/AttendancePage'
import { CommissionDetailPage } from './docente/CommissionDetailPage'
import { TeacherCommissionsPage } from './docente/TeacherCommissionsPage'
import { TeacherLayout } from './docente/TeacherLayout'
import { TeacherProfilePage } from './docente/TeacherProfilePage'
import { TeacherStudentsPage } from './docente/TeacherStudentsPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
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
 * **Cada sección cuelga de su layout y el layout no sabe qué pantalla hay.** Administración tiene sus
 * seis pantallas, Docente cuatro y Alumno cuatro; `/docente/notas`, `/alumno/pagar-la-cuota` y
 * `/alumno/certificados` no existen, porque los ítems Won't no son enlaces (D20). Agregar una
 * pantalla es agregar una ruta hija: ni el armazón ni el guard de rol cambian.
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
            <TeacherLayout />
          </RequireRole>
        }
      >
        <Route index element={<TeacherCommissionsPage />} />
        <Route path="alumnos" element={<TeacherStudentsPage />} />
        <Route path="alumnos/:codigo" element={<CommissionDetailPage />} />
        <Route path="asistencia" element={<AttendancePage />} />
        <Route path="perfil" element={<TeacherProfilePage />} />
      </Route>

      <Route
        path="/alumno"
        element={
          <RequireRole allowedRoles={['ALUMNO']}>
            <StudentLayout />
          </RequireRole>
        }
      >
        <Route index element={<StudentCoursesPage />} />
        <Route path="cursos/:codigo" element={<CourseDetailPage />} />
        <Route path="pagos" element={<StudentPaymentsPage />} />
        <Route path="perfil" element={<StudentProfilePage />} />
      </Route>

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
