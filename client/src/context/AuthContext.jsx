import { createContext, useMemo, useState } from "react";
import API from "../api/axios";
import { hasPermission as checkPermission } from "../utils/permissions";

export const AuthContext = createContext(null);

const readStoredUser = () => {
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);

  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    const userData = {
      id: res.data.id,
      name: res.data.name,
      email: res.data.email,
      role: res.data.role,
      status: res.data.status,
      permissions: res.data.permissions || [],
      facility: res.data.facility || null,
    };

    localStorage.setItem("token", res.data.token);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth_user");
    setUser(null);
    window.location.href = "/";
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      hasPermission: (permission) => checkPermission(user?.permissions || [], permission),
      isAuthenticated: Boolean(localStorage.getItem("token")),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
