import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import "./styles/styles.scss";
import Login from "./pages/Login";
import Register from "./pages/Register";
<<<<<<< HEAD
import { isAuthenticated, initializeAuth, logout } from "./services/auth";
=======
import ProjectDashboard from "./pages/ProjectDashboard";
import { isAuthenticated, initializeAuth } from "./services/auth";
>>>>>>> 660e4d4 (add projet version 1.0.0)

initializeAuth();

// Pages réservées aux visiteurs non connectés (login, register)
const PublicRoute = ({ children }) =>
  isAuthenticated() ? <Navigate to="/" replace /> : children;

// Pages réservées aux utilisateurs connectés
const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" replace />;

<<<<<<< HEAD
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

=======
>>>>>>> 660e4d4 (add projet version 1.0.0)
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
<<<<<<< HEAD
            <Dashboard />
=======
            <ProjectDashboard />
>>>>>>> 660e4d4 (add projet version 1.0.0)
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;