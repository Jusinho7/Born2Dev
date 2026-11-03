import { setAuthToken, logoutUser } from "./api";

// Décode le payload d'un JWT (base64url + UTF-8). atob() seul échoue
// dès que le token contient "-" ou "_" ou n'a pas de padding.
const decodeJwtPayload = (token) => {
  const part = token.split(".")[1];
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const json = decodeURIComponent(
    atob(padded)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(json);
};

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  setAuthToken(null);
};

export const login = (token, refreshToken) => {
  setAuthToken(token); // stocke aussi le token dans localStorage
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
};

export const logout = async () => {
  try {
    await logoutUser();
  } catch (error) {
    console.error("Erreur lors de la déconnexion API:", error);
  } finally {
    clearSession();
    window.location.replace("/login");
  }
};

export const isAuthenticated = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;

    if (token.split(".").length !== 3) {
      clearSession();
      return false;
    }

    const { exp } = decodeJwtPayload(token);

    // Pas de date d'expiration dans le token : on le considère valide
    if (exp && exp * 1000 <= Date.now()) {
      clearSession();
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Erreur vérification token:", error);
    clearSession();
    return false;
  }
};

export const getToken = () => localStorage.getItem("token");

export const getUserInfo = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    return payload.data || payload;
  } catch (error) {
    console.error("❌ Erreur récupération info utilisateur:", error);
    return null;
  }
};

export const initializeAuth = () => {
  const token = localStorage.getItem("token");

  if (token && isAuthenticated()) {
    setAuthToken(token);
  }
  // si le token est invalide, isAuthenticated() a déjà nettoyé la session

  return isAuthenticated();
};