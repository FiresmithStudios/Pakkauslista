import { Routes, Route, Navigate } from 'react-router-dom';
import { OperatorProvider } from './OperatorContext';
import NameScreen from './pages/NameScreen';
import ContainerSelectionScreen from './pages/ContainerSelectionScreen';
import ContainerDetailScreen from './pages/ContainerDetailScreen';
import PositionDetailScreen from './pages/PositionDetailScreen';
import AiSearchScreen from './pages/AiSearchScreen';

function App() {
  return (
    <OperatorProvider>
      <Routes>
        <Route path="/" element={<NameScreen />} />
        <Route path="/containers" element={<ContainerSelectionScreen />} />
        <Route path="/containers/:containerId" element={<ContainerDetailScreen />} />
        <Route path="/containers/:containerId/positions/:positionId" element={<PositionDetailScreen />} />
        <Route path="/ai-search" element={<AiSearchScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OperatorProvider>
  );
}

export default App;
