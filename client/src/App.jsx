import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";
import CSVUpload from "./pages/CSVUpload";
import Certificates from "./pages/Certificates";
import BatchProgress from "./pages/BatchProgress";
import UserManagement from "./pages/UserManagement";
import PublicCertificateLookup from "./pages/PublicCertificateLookup";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PERMISSIONS } from "./utils/permissions";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/public-certificates" element={<PublicCertificateLookup />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD}>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/templates"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_TEMPLATES}>
              <Layout>
                <Templates />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/template-editor/:id"
          element={
            <ProtectedRoute permission={PERMISSIONS.MANAGE_TEMPLATES}>
              <Layout>
                <TemplateEditor />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="/template-editor" element={<Navigate to="/templates" replace />} />

        <Route
          path="/csv-upload"
          element={
            <ProtectedRoute permission={PERMISSIONS.MANAGE_BATCHES}>
              <Layout>
                <CSVUpload />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/certificates"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_CERTIFICATES}>
              <Layout>
                <Certificates />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/batch-progress/:id"
          element={
            <ProtectedRoute permission={PERMISSIONS.VIEW_BATCHES}>
              <Layout>
                <BatchProgress />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/user-management"
          element={
            <ProtectedRoute
              anyPermissions={[PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_FACILITIES]}
            >
              <Layout>
                <UserManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
