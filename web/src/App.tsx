import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { Leaderboard } from "./pages/Leaderboard";
import { ModelPage } from "./pages/Model";
import { GamePage } from "./pages/Game";
import { Live } from "./pages/Live";
import { About } from "./pages/About";

export function App() {
  return (
    <BrowserRouter>
      <div className="wrap">
        <header>
          <Link className="brand" to="/">
            <h1>BALATRO</h1>
            <span className="suits"><span className="r">♥</span><span className="b">♠</span><span className="r">♦</span><span className="b">♣</span></span>
            <h1 style={{ fontSize: 22, WebkitTextFillColor: "var(--muted)" }}>× LLM</h1>
          </Link>
          <div className="spacer" />
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => "tab-link" + (isActive ? " active" : "")}>🏆 Leaderboard</NavLink>
            <NavLink to="/live" className={({ isActive }) => "tab-link" + (isActive ? " active" : "")}>▶ Live</NavLink>
            <NavLink to="/about" className={({ isActive }) => "tab-link" + (isActive ? " active" : "")}>About</NavLink>
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/model/:name" element={<ModelPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/live" element={<Live />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <div className="foot">Open-source LLM benchmark · models play real Balatro · <Link to="/about" style={{ color: "var(--muted)" }}>how it works</Link></div>
      </div>
    </BrowserRouter>
  );
}
