import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import Loader from "../components/Loader";
import { PERMISSIONS } from "../utils/permissions";
import useAuth from "../components/useAuth";

const defaultUserForm = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  role: "user",
  status: "a",
  facility_id: "",
  permissions: [],
};

const defaultFacilityForm = {
  name: "",
  code: "",
  status: "a",
};

const permissionOptions = [
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.VIEW_TEMPLATES,
  PERMISSIONS.MANAGE_TEMPLATES,
  PERMISSIONS.VIEW_BATCHES,
  PERMISSIONS.MANAGE_BATCHES,
  PERMISSIONS.VIEW_CERTIFICATES,
  PERMISSIONS.MANAGE_CERTIFICATES,
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_FACILITIES,
];

export default function UserManagement() {
  const { hasPermission } = useAuth();
  const canManageUsers = hasPermission(PERMISSIONS.MANAGE_USERS);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [facilityForm, setFacilityForm] = useState(defaultFacilityForm);
  const [editUserId, setEditUserId] = useState(null);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [submittingFacility, setSubmittingFacility] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canManageFacilities = hasPermission(PERMISSIONS.MANAGE_FACILITIES);

  const resetAlerts = () => {
    setError("");
    setMessage("");
  };

  const loadData = async () => {
    const [usersRes, facilitiesRes] = await Promise.all([
      canManageUsers ? API.get("/users") : Promise.resolve({ data: [] }),
      (canManageUsers || canManageFacilities)
        ? API.get("/users/meta/facilities")
        : Promise.resolve({ data: [] }),
    ]);
    setUsers(canManageUsers ? (usersRes.data || []) : []);
    setFacilities((canManageUsers || canManageFacilities) ? (facilitiesRes.data || []) : []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [canManageUsers, canManageFacilities]);

  const roleOptions = useMemo(
    () => [
      { label: "User", value: "user" },
      { label: "Facility Manager", value: "facility_manager" },
      { label: "Admin", value: "admin" },
    ],
    [],
  );

  const togglePermission = (permission) => {
    setUserForm((prev) => {
      const hasItem = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: hasItem
          ? prev.permissions.filter((item) => item !== permission)
          : [...prev.permissions, permission],
      };
    });
  };

  const handleCreateOrUpdateUser = async (event) => {
    event.preventDefault();
    resetAlerts();
    setSubmittingUser(true);

    try {
      const payload = {
        ...userForm,
        facility_id: userForm.facility_id || null,
      };

      if (!editUserId && !payload.password) {
        setError("Password is required for new user");
        setSubmittingUser(false);
        return;
      }

      if (editUserId) {
        await API.put(`/users/${editUserId}`, payload);
        setMessage("User updated successfully");
      } else {
        await API.post("/users", payload);
        setMessage("User created successfully");
      }

      setEditUserId(null);
      setUserForm(defaultUserForm);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save user");
    } finally {
      setSubmittingUser(false);
    }
  };

  const startEdit = (user) => {
    resetAlerts();
    setEditUserId(user.id);
    setUserForm({
      name: user.name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      password: "",
      role: user.role || "user",
      status: user.status || "a",
      facility_id: user.facility_id || "",
      permissions: user.permissions || [],
    });
  };

  const cancelEdit = () => {
    setEditUserId(null);
    setUserForm(defaultUserForm);
  };

  const handleDeleteUser = async (id) => {
    const ok = window.confirm("Delete this user?");
    if (!ok) return;

    resetAlerts();
    try {
      await API.delete(`/users/${id}`);
      setMessage("User deleted");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete user");
    }
  };

  const handleCreateFacility = async (event) => {
    event.preventDefault();
    resetAlerts();
    setSubmittingFacility(true);

    try {
      await API.post("/users/meta/facilities", facilityForm);
      setFacilityForm(defaultFacilityForm);
      setMessage("Facility created");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create facility");
    } finally {
      setSubmittingFacility(false);
    }
  };

  if (loading) return <Loader label="Loading user management..." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">User Management</h2>
        <p className="text-sm text-slate-500">Manage users, facilities, roles and permissions</p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      {canManageUsers && (
        <form
          onSubmit={handleCreateOrUpdateUser}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold">{editUserId ? "Edit User" : "Create User"}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Name"
              value={userForm.name}
              onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Email"
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Mobile"
              value={userForm.mobile}
              onChange={(e) => setUserForm((prev) => ({ ...prev, mobile: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder={editUserId ? "New Password (optional)" : "Password"}
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
            />
            <select
              className="rounded border border-slate-300 px-3 py-2"
              value={userForm.role}
              onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
            >
              {roleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2"
              value={userForm.status}
              onChange={(e) => setUserForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="a">Active</option>
              <option value="i">Inactive</option>
            </select>
            <select
              className="rounded border border-slate-300 px-3 py-2"
              value={userForm.facility_id}
              onChange={(e) => setUserForm((prev) => ({ ...prev, facility_id: e.target.value }))}
            >
              <option value="">No Facility</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name} ({facility.code})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Custom Permissions</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {permissionOptions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={userForm.permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submittingUser}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {submittingUser ? "Saving..." : editUserId ? "Update User" : "Create User"}
            </button>
            {editUserId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      )}

      {canManageFacilities && (
        <form onSubmit={handleCreateFacility} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Create Facility</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Facility name"
              value={facilityForm.name}
              onChange={(e) => setFacilityForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-300 px-3 py-2"
              placeholder="Facility code"
              value={facilityForm.code}
              onChange={(e) => setFacilityForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              required
            />
            <button
              type="submit"
              disabled={submittingFacility}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {submittingFacility ? "Creating..." : "Create Facility"}
            </button>
          </div>
        </form>
      )}

      {canManageUsers && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Users</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Facility</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-2 py-2">{user.name}</td>
                    <td className="px-2 py-2">{user.email}</td>
                    <td className="px-2 py-2">{user.role}</td>
                    <td className="px-2 py-2">{user.facility_name || "-"}</td>
                    <td className="px-2 py-2">{user.status === "a" ? "Active" : "Inactive"}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!canManageUsers && canManageFacilities && (
        <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Facility-only access enabled. User CRUD is restricted.
        </p>
      )}
    </div>
  );
}
