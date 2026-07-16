import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Map from './pages/Map.jsx';
import Report from './pages/Report.jsx';
import Rescue from './pages/Rescue.jsx';
import Admin from './pages/Admin.jsx';

function Nav() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `px-3 py-1 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-700 text-white' : 'text-blue-700 hover:bg-blue-50'
    }`;

  return (
    <nav className="bg-white shadow-sm px-6 py-3 flex items-center gap-2 flex-wrap">
      <NavLink to="/" end className={linkClass}>Home</NavLink>
      <NavLink to="/map" className={linkClass}>Map</NavLink>
      <NavLink to="/report" className={linkClass}>Report</NavLink>
      <NavLink to="/rescue" className={linkClass}>Rescue</NavLink>
      <NavLink to="/admin" className={linkClass}>Admin</NavLink>
      <span className="flex-1" />
      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 hidden sm:inline">{user.name}</span>
          <button
            onClick={logout}
            className="px-3 py-1 rounded text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <NavLink to="/login" className={linkClass}>Login</NavLink>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/map" element={<Map />} />
        <Route path="/report" element={<Report />} />
        <Route path="/rescue" element={<Rescue />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
