import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PinLoginScreen from './pages/PinLoginScreen';
import ContainerSelectionScreen from './pages/ContainerSelectionScreen';
import ContainerDetailScreen from './pages/ContainerDetailScreen';
import PositionDetailScreen from './pages/PositionDetailScreen';
import AiSearchScreen from './pages/AiSearchScreen';
import SettingsScreen from './pages/SettingsScreen';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PinLoginScreen />} />
        <Route
          path="/containers"
          element={
            <ProtectedRoute>
              <ContainerSelectionScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/containers/:containerId"
          element={
            <ProtectedRoute>
              <ContainerDetailScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/containers/:containerId/positions/:positionId"
          element={
            <ProtectedRoute>
              <PositionDetailScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-search"
          element={
            <ProtectedRoute>
              <AiSearchScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsScreen />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/containers" replace />} />
        <Route path="*" element={<Navigate to="/containers" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
