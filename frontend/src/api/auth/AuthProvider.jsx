import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("plastiqueria_session");
    if (session) {
      const parsed = JSON.parse(session);
      setUser(parsed.user);
      setToken(parsed.token);
    }
    setLoading(false);
  }, []);

  const login = (data) => {
    localStorage.setItem("plastiqueria_session", JSON.stringify(data));
    setUser(data.user);
    setToken(data.token);
  };

  const logout = () => {
    localStorage.removeItem("plastiqueria_session");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
