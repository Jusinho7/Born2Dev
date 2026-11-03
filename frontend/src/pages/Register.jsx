import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import { getErrorMessage } from "../utils/getErrorMessage";
import useDocumentTitle from "../components/useDocumentTitle";
import LanguageSelector from "../components/LanguageSelector";

const MIN_PASSWORD_LENGTH = 6;

const Register = ({ t, language, setLanguage }) => {
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

      setMessage(res.data?.message || "Inscription réussie 🎉");
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
    <div className="auth-page">
      <div className="auth-change">
        <LanguageSelector
          language={language}
          setLanguage={setLanguage}
        />
      </div>

      <h1 className="auth-slogan">Check-Eko</h1>

      <div className="auth-container">
        <div className="auth-header">
          <div className="brand">
            <img
              src="/assets/fanilo.png"
              alt="fanilo logo"
              className="brand-logo"
            />
          </div>

          <h2>{t.register}</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">{t.username}</label>
            <input
              id="username"
              type="text"
              name="username"
              placeholder={t.usernamePlaceholder}
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="username"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t.email}</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder={t.emailPlaceholder}
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="email"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t.password}</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder={t.createPasswordPlaceholder}
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
            <label htmlFor="confirmPassword">{t.confirmPassword}</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder={t.confirmPasswordPlaceholder}
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
            {loading ? t.registering : `${t.registerButton} →`}
          </button>
        </form>

        <div className="auth-links">
          <div className="switch-auth">
            {t.alreadyAccount} <Link to="/login">{t.loginLink}</Link>
          </div>
        </div>

        {message && (
          <div className={`auth-message ${messageType || ""}`} role="alert">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;