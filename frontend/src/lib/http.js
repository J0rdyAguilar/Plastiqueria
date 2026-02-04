import axios from "axios";
import { getSession } from "./auth";

// baseURL apunta a tu backend laravel (/api)
const baseURL =
  import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : "http://127.0.0.1:8000/api";

export const http = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
  },
});

// Mete el token automáticamente
http.interceptors.request.use((config) => {
  const token = getSession()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
