import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { login } from "../services/auth";
import { getErrorMessage } from "../utils/getErrorMessage";
import useDocumentTitle from "../components/useDocumentTitle";
import LanguageSelector from "../components/LanguageSelector";
import { Localized } from "../contexts/LanguageContext";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(null); // "error" | "success"
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  useDocumentTitle("Connexion");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType(null);

    try {
      const res = await loginUser({
        email: formData.email,
        password: formData.password,
      });

      const accessToken = res.data.access_token || res.data.token;
      const refreshToken = res.data.refresh_token || res.data.refreshToken;

      if (!accessToken) {
        throw new Error("Le serveur n'a retourné aucun jeton d'accès.");
      }

      login(accessToken, refreshToken);
      setMessage("Connexion réussie");
      setMessageType("success");

      setTimeout(() => {
        navigate("/", { replace: true });
      }, 500);
    } catch (err) {
      setMessage(getErrorMessage(err, "Impossible de se connecter"));
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Localized>
    <div className="auth-page">
      <div className="auth-language">
        <LanguageSelector />
      </div>
      <h1 className="auth-slogan"><span className="highlight1">Check</span>-<span className="highlight2">Eko</span></h1>

      <div className="auth-container">
        <div className="auth-header">
          <div className="brand">
            <img
              src="/assets/fanilo.png"
              alt="fanilo logo"
              className="brand-logo"
            />
          </div>

          <h2>Connexion</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email :</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="Entrez votre adresse email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="email"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe :</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Entrez votre mot de passe"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="current-password"
              className="input-field"
            />
          </div>

          <div className="separator"></div>

          <button
            type="submit"
            disabled={loading}
            className={`auth-button ${loading ? "loading" : ""}`}
          >
            {loading ? "Connexion..." : "Se connecter →"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password" className="forgot-password">
            Mot de passe oublié ?
          </Link>
          <div className="switch-auth">
            Vous n'avez pas de compte ? <Link to="/register">Créer un compte</Link>
          </div>
        </div>

        {message && (
          <div className={`auth-message ${messageType || ""}`} role="alert">
            {message}
          </div>
        )}
      </div>
    </div>
    </Localized>
  );
};

export default Login;