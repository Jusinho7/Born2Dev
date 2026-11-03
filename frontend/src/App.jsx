import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import "./styles/styles.scss";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProjectDashboard from "./pages/ProjectDashboard";
import { isAuthenticated, initializeAuth } from "./services/auth";

initializeAuth();

// Pages réservées aux visiteurs non connectés (login, register)
const PublicRoute = ({ children }) =>
  isAuthenticated() ? <Navigate to="/" replace /> : children;

// Pages réservées aux utilisateurs connectés
const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" replace />;

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
            <ProjectDashboard />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;