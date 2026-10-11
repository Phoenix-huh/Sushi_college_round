import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SidebarLayout } from './components/SidebarLayout';
import { Landing } from './pages/Landing';
import { Extension } from './pages/Extension';
import { Patches } from './pages/Patches';
import { Deployments } from './pages/Deployments';
import { Verification } from './pages/Verification';
import { Conflicts } from './pages/Conflicts';
import { Audit } from './pages/Audit';
import { Readme } from './pages/Readme';
import { Architecture } from './pages/Architecture';
import { BinaryCursorTrail } from './components/BinaryCursorTrail';

function App() {
  return (
    <BrowserRouter>
      <BinaryCursorTrail />
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/extension" element={<Extension />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/readme" element={<Readme />} />
          <Route path="/patches" element={<Patches />} />
          <Route path="/deployments" element={<Deployments />} />
          <Route path="/verification" element={<Verification />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
