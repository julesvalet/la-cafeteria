import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Header />
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scopa" element={<ScopaLobby />} />
          <Route path="/scopa/:code" element={<ScopaRoom />} />
          <Route path="/puissance4" element={<P4Lobby />} />
          <Route path="/puissance4/:code" element={<P4Room />} />
          <Route path="/puissance4-original" element={<OriginalLobby />} />
          <Route path="/puissance4-original/:code" element={<OriginalRoom />} />
          <Route path="/uno" element={<UnoLobby />} />
          <Route path="/uno/:code" element={<UnoRoom />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
