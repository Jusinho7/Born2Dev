import { useState } from "react";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import "./App.css";
import "./styles/styles.scss";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Actu from "./pages/Actu";
import Navigation from "./components/Navigation";
import Navbar from "./components/NavBar";
import { isAuthenticated, initializeAuth, logout } from "./services/auth";

initializeAuth();

// Pages réservées aux visiteurs non connectés (login, register)
const PublicRoute = ({ children }) =>
  isAuthenticated() ? <Navigate to="/" replace /> : children;

// Pages réservées aux utilisateurs connectés
const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" replace />;

// Layout commun (Navbar + Sidebar). Les pages enfants s'affichent dans <Outlet />.
// Le layout reste monté quand on change de page : la sidebar ne se réinitialise plus.
const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <div className="layout">
      <Navbar toggleSidebar={toggleSidebar} />
      <div className="main">
        <div className={`navigation ${sidebarOpen ? "" : "hiddene"}`}>
          <Navigation
            Style={`sidebar ${sidebarOpen ? "" : "hidden"}`}
            isClose={!sidebarOpen}
          />
        </div>
        <div className="homecontent">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

// Page principale Dashboard
const Dashboard = () => (
  <div style={{ padding: "2rem", textAlign: "center" }}>
    <h1>Connecté</h1>
    <p>Dashboard à venir</p>
    <button type="button" className="btn btn-outline-secondary" onClick={logout}>
      Se déconnecter
    </button>
  </div>
);

const App = () => (
  <BrowserRouter>
    <Routes>
      {/* Routes publiques */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Routes privées : Navbar + Sidebar */}
      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/actu" element={<Actu />} />
      </Route>

      {/* Redirection par défaut */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;