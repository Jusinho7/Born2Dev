
import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet
} from "react-router-dom";

import "./App.css";
import "./styles/styles.scss";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Actu from "./pages/Actu";

import Navigation from "./components/Navigation";
import Navbar from "./components/NavBar";

import { isAuthenticated, initializeAuth, logout } from "./services/auth";

// Traductions
import fr from "./traduction/fr";
import mg from "./traduction/mg";
import en from "./traduction/en";

const translations = { fr, mg, en };

initializeAuth();

// Pages réservées aux visiteurs non connectés
const PublicRoute = ({ children }) =>
  isAuthenticated() ? <Navigate to="/" replace /> : children;

// Pages réservées aux utilisateurs connectés
const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" replace />;

// Layout commun : Navbar + Sidebar
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

// Dashboard temporaire
const Dashboard = () => (
  <div style={{ padding: "2rem", textAlign: "center" }}>
    <h1>Connecté</h1>
    <p>Dashboard à venir</p>

    <button
      type="button"
      className="btn btn-outline-secondary"
      onClick={logout}
    >
      Se déconnecter
    </button>
  </div>
);

const App = () => {
  // Langue choisie par l'utilisateur
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("language") || "fr";
  });

  // Sauvegarder la langue
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  // Traductions correspondant à la langue choisie
  const t = translations[language] || translations.fr;

  return (
    <BrowserRouter>
      <Routes>

        {/* Routes publiques */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login
                t={t}
                language={language}
                setLanguage={setLanguage}
              />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register
                t={t}
                language={language}
                setLanguage={setLanguage}
              />
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
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
};

export default App;