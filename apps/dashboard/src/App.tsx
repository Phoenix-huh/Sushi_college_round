import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarLayout } from './components/SidebarLayout';
import { Patches } from './pages/Patches';
import { Deployments } from './pages/Deployments';
import { Verification } from './pages/Verification';
import { Conflicts } from './pages/Conflicts';
import { Audit } from './pages/Audit';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SidebarLayout />}>
          <Route index element={<Navigate to="/patches" replace />} />
          <Route path="patches" element={<Patches />} />
          <Route path="deployments" element={<Deployments />} />
          <Route path="verification" element={<Verification />} />
          <Route path="conflicts" element={<Conflicts />} />
          <Route path="audit" element={<Audit />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
