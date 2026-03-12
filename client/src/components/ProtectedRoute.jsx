import { Navigate } from "react-router-dom";
import useAuth from "./useAuth";

export default function ProtectedRoute({ children, permission, anyPermissions = [] }) {
  const token = localStorage.getItem("token");
  const { hasPermission } = useAuth();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (Array.isArray(anyPermissions) && anyPermissions.length > 0) {
    const allowed = anyPermissions.some((item) => hasPermission(item));
    if (!allowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
