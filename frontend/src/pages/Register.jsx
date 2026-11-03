import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import { getErrorMessage } from "../utils/getErrorMessage";
import useDocumentTitle from "../components/useDocumentTitle";
import LanguageSelector from "../components/LanguageSelector";
import { Localized } from "../contexts/LanguageContext";

const MIN_PASSWORD_LENGTH = 8;

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(null); // "error" | "success"
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  useDocumentTitle("Inscription");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const showError = (text) => {
    setMessage(text);
    setMessageType("error");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setMessageType(null);

    if (formData.password !== formData.confirmPassword) {
      return showError("Les mots de passe ne correspondent pas");
    }

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      return showError(
        `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`
      );
    }

    setLoading(true);

    try {
      const res = await registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
      });

      setMessage(res.data?.message || "Inscription réussie");
      setMessageType("success");

      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      console.error("Erreur détaillée:", err.response || err);
      showError(getErrorMessage(err, "Impossible de s'inscrire"));
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
      <h1 className="auth-slogan">Ny vaovao marina</h1>

      <div className="auth-container">
        <div className="auth-header">
          <div className="brand">
            <img
              src="/assets/fanilo.png"
              alt="fanilo logo"
              className="brand-logo"
            />
          </div>

          <h2>Créer un compte</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Nom d'utilisateur :</label>
            <input
              id="username"
              type="text"
              name="username"
              placeholder="Entrez votre nom d'utilisateur"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="username"
              className="input-field"
            />
          </div>

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
              placeholder="Créez votre mot de passe"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={MIN_PASSWORD_LENGTH}
              disabled={loading}
              autoComplete="new-password"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmer le mot de passe :</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="Confirmez votre mot de passe"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={MIN_PASSWORD_LENGTH}
              disabled={loading}
              autoComplete="new-password"
              className="input-field"
            />
          </div>

          <div className="separator"></div>

          <button
            type="submit"
            disabled={loading}
            className={`auth-button ${loading ? "loading" : ""}`}
          >
            {loading ? "Création du compte..." : "Créer un compte →"}
          </button>
        </form>

        <div className="auth-links">
          <div className="switch-auth">
            Vous avez déjà un compte ? <Link to="/login">Se connecter</Link>
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

export default Register;