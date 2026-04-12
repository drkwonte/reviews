import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import DashboardPage from '@/pages/DashboardPage'
import LandingPage from '@/pages/LandingPage'
import NotesListPage from '@/pages/NotesListPage'
import NoteNewPage from '@/pages/NoteNewPage'
import NoteDetailPage from '@/pages/NoteDetailPage'
import StatsPage from '@/pages/StatsPage'
import SettingsPage from '@/pages/SettingsPage'
import AccountNoticeDetailPage from '@/pages/AccountNoticeDetailPage'
import AdminDashboardPage from '@/pages/AdminDashboardPage'
import AdminRoute from '@/components/AdminRoute'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* 공개 라우트 */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* 보호된 라우트 */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/notes" element={<NotesListPage />} />
            <Route path="/notes/new" element={<NoteNewPage />} />
            <Route path="/notes/:id" element={<NoteDetailPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/notices/:id" element={<AccountNoticeDetailPage />} />
          </Route>

          {/* 관리자 전용 라우트 */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>

          {/* 404 → 랜딩 페이지로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
