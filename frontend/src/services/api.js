import axios from "axios";

<<<<<<< HEAD
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
=======
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
>>>>>>> 660e4d4 (add projet version 1.0.0)

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// ---------- État global ----------
let pendingRequests = 0;
let isRefreshing = false;
let failedQueue = [];

// Ces routes ne doivent jamais déclencher de refresh de token
// (un 401 sur /login = mauvais identifiants, pas un token expiré)
const AUTH_ENDPOINTS = ["/login", "/register", "/refresh-token"];
const isAuthEndpoint = (url = "") =>
  AUTH_ENDPOINTS.some((path) => url.endsWith(path));

const isAuthPage = () =>
  window.location.pathname === "/login" ||
  window.location.pathname === "/register";

const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) promise.reject(error);
    else promise.resolve(token);
  });
  failedQueue = [];
};

const updateLoadingState = () => {
  window.dispatchEvent(
    new CustomEvent("globalLoading", {
      detail: { isLoading: pendingRequests > 0, pendingRequests },
    })
  );
};

const startRequest = () => {
  pendingRequests++;
  updateLoadingState();
};

const endRequest = () => {
  pendingRequests = Math.max(0, pendingRequests - 1);
  updateLoadingState();
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  error.message ||
  "Erreur réseau";

// ---------- Token ----------
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
  }
};

// Récupération du token au chargement
const savedToken = localStorage.getItem("token");
if (savedToken) {
  setAuthToken(savedToken);
}

// ---------- Intercepteur requêtes ----------
api.interceptors.request.use(
  (config) => {
    startRequest();

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    endRequest();
    return Promise.reject(error);
  }
);

// ---------- Intercepteur réponses ----------
api.interceptors.response.use(
  (response) => {
    endRequest();
    return response;
  },
  async (error) => {
    endRequest();

    const originalRequest = error.config;
    const shouldTryRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url);

    if (!shouldTryRefresh) {
      console.error("❌ Erreur API:", getErrorMessage(error));
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Un refresh est déjà en cours : on attend son résultat
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      // axios "nu" (et non `api`) pour ne pas repasser dans les intercepteurs
      const { data } = await axios.post(`${API_URL}/refresh-token`, {
        refreshToken,
      });

      setAuthToken(data.token);
      processQueue(null, data.token);

      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      setAuthToken(null);
      localStorage.removeItem("refreshToken");

      if (!isAuthPage()) {
        window.location.href = "/login";
      }

      console.error("❌ Erreur API:", getErrorMessage(error));
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

// ---------- Retry avec exponential backoff ----------
const isRetryableError = (error) =>
  !error.response ||
  error.response.status >= 500 ||
  error.code === "ERR_NETWORK" ||
  error.code === "ECONNABORTED" ||
  error.message?.includes("timeout");

export const retryRequest = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0 || !isRetryableError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
};

// ---------- 🔐 Authentification ----------
export const registerUser = (userData) => api.post("/register", userData);
export const loginUser = (credentials) => api.post("/login", credentials);
export const logoutUser = () => api.post("/logout");
export const verifyToken = () => api.get("/verify-token");
export const getUserProfile = () => api.get("/me");

export default api;