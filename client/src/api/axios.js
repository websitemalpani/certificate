import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const APP_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("auth_user");
        window.location.href = "/";
      }

      if (status === 403) {
        alert("Access denied");
      }
    }

    return Promise.reject(error);
  },
);

export const toStorageUrl = (rawPath) => {
  if (!rawPath) return "";
  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  const normalized = String(rawPath).replace(/\\/g, "/");
  const storageIndex = normalized.indexOf("/storage/");

  if (storageIndex >= 0) {
    return `${APP_ORIGIN}${normalized.slice(storageIndex)}`;
  }

  if (normalized.startsWith("storage/")) {
    return `${APP_ORIGIN}/${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return `${APP_ORIGIN}${normalized}`;
  }

  return `${APP_ORIGIN}/${normalized}`;
};

export default API;
