import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { ScopaLobby } from './features/scopa/ScopaLobby';
import { ScopaRoom } from './features/scopa/ScopaRoom';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Header />
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scopa" element={<ScopaLobby />} />
          <Route path="/scopa/:code" element={<ScopaRoom />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
