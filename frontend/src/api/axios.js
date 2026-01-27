import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api/v1",
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const session = localStorage.getItem("plastiqueria_session");
  if (session) {
    const { token } = JSON.parse(session);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("plastiqueria_session");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
