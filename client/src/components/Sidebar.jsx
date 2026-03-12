import { Link, useLocation } from "react-router-dom";
import useAuth from "./useAuth";
import { PERMISSIONS } from "../utils/permissions";

const menu = [
  { name: "Dashboard", path: "/dashboard", permission: PERMISSIONS.VIEW_DASHBOARD },
  { name: "Templates", path: "/templates", permission: PERMISSIONS.VIEW_TEMPLATES },
  { name: "CSV Upload", path: "/csv-upload", permission: PERMISSIONS.MANAGE_BATCHES },
  { name: "Certificates", path: "/certificates", permission: PERMISSIONS.VIEW_CERTIFICATES },
  {
    name: "User Management",
    path: "/user-management",
    anyPermissions: [PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FACILITIES],
  },
];

export default function Sidebar({ onNavigate }) {
  const location = useLocation();
  const { hasPermission } = useAuth();

  return (
    <aside className="h-full w-72 bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 px-5 py-5">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
        <p className="text-xs text-slate-300">Certificate Management</p>
      </div>

      <nav className="space-y-1 p-3">
        {menu.filter((item) => {
          if (item.permission) return hasPermission(item.permission);
          if (Array.isArray(item.anyPermissions) && item.anyPermissions.length > 0) {
            return item.anyPermissions.some((permission) => hasPermission(permission));
          }
          return false;
        }).map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
