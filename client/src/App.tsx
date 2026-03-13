import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
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
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/containers" element={<ContainerSelectionScreen />} />
          <Route path="/containers/:containerId" element={<ContainerDetailScreen />} />
          <Route path="/containers/:containerId/positions/:positionId" element={<PositionDetailScreen />} />
          <Route path="/ai-search" element={<AiSearchScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="/" element={<Navigate to="/containers" replace />} />
        <Route path="*" element={<Navigate to="/containers" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
