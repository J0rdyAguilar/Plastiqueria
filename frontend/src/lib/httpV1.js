import axios from "axios";
import { getSession } from "./auth";

const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : "http://127.0.0.1:8000/api/v1";

export const httpV1 = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
  },
});

httpV1.interceptors.request.use((config) => {
  const token = getSession()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});