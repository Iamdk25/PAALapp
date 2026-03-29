import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SessionGate } from './components/SessionGate'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import CoursesPage from './pages/CoursesPage'
import ChatPage from './pages/ChatPage'
import QuizPage from './pages/QuizPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route
        path="/learn"
        element={
          <ProtectedRoute>
            <SessionGate>
              <ChatPage />
            </SessionGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <ProtectedRoute>
            <SessionGate>
              <QuizPage />
            </SessionGate>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <SessionGate>
              <AnalyticsPage />
            </SessionGate>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
