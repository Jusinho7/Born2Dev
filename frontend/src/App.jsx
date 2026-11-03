import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import "./styles/styles.scss";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { isAuthenticated, initializeAuth, logout } from "./services/auth";

initializeAuth();

// Pages réservées aux visiteurs non connectés (login, register)
const PublicRoute = ({ children }) =>
  isAuthenticated() ? <Navigate to="/" replace /> : children;

// Pages réservées aux utilisateurs connectés
const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" replace />;

// Page temporaire — à remplacer par votre dashboard
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
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;