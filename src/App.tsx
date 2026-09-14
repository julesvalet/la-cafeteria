import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { ScopaLobby } from './features/scopa/ScopaLobby';
import { ScopaRoom } from './features/scopa/ScopaRoom';
import { P4Lobby } from './features/puissance4/P4Lobby';
import { P4Room } from './features/puissance4/P4Room';
import { OriginalLobby } from './features/puissance4/original/OriginalLobby';
import { OriginalRoom } from './features/puissance4/original/OriginalRoom';
import { UnoLobby } from './features/uno/UnoLobby';
import { UnoRoom } from './features/uno/UnoRoom';
import { AuthProvider } from './features/account/AuthProvider';
import { LoginPage } from './features/account/LoginPage';
import { RegisterPage } from './features/account/RegisterPage';
import { ProfilePage } from './features/account/ProfilePage';

const Flip7Lobby = lazy(() => import('./features/flip7/Flip7Lobby').then(m => ({ default: m.Flip7Lobby })));
const Flip7Room = lazy(() => import('./features/flip7/Flip7Room').then(m => ({ default: m.Flip7Room })));

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* Le provider enveloppe l'en-tête autant que les pages : c'est lui qui
          alimente le raccourci de compte, visible partout sur le site. */}
      <AuthProvider>
      <Header />
      <main className="site-main">
        <Suspense fallback={<div className="container" role="status" style={{ padding: 40 }}>La table se prépare…</div>}><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scopa" element={<ScopaLobby />} />
          <Route path="/scopa/:code" element={<ScopaRoom />} />
          <Route path="/puissance4" element={<P4Lobby />} />
          <Route path="/puissance4/:code" element={<P4Room />} />
          <Route path="/puissance4-original" element={<OriginalLobby />} />
          <Route path="/puissance4-original/:code" element={<OriginalRoom />} />
          <Route path="/uno" element={<UnoLobby />} />
          <Route path="/uno/:code" element={<UnoRoom />} />
          <Route path="/flip7" element={<Flip7Lobby />} />
          <Route path="/flip7/:code" element={<Flip7Room />} />
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/inscription" element={<RegisterPage />} />
          <Route path="/compte" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense>
      </main>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
