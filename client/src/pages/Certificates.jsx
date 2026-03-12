import { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import Loader from "../components/Loader";
import useAuth from "../components/useAuth";
import { PERMISSIONS } from "../utils/permissions";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const parseDataJson = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const readValueByAliases = (source, aliases = []) => {
  if (!source || typeof source !== "object") return "";
  const normalizedEntries = new Map(
    Object.entries(source).map(([key, val]) => [normalizeKey(key), val]),
  );

  for (const alias of aliases) {
    const direct = source[alias];
    if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
      return String(direct);
    }
    const normalized = normalizedEntries.get(normalizeKey(alias));
    if (normalized !== undefined && normalized !== null && String(normalized).trim() !== "") {
      return String(normalized);
    }
  }

  return "";
};

const resolveStudentName = (certificate) => {
  if (!certificate) return "";
  return (
    certificate.student_name ||
    readValueByAliases(parseDataJson(certificate.data_json), [
      "student_name",
      "student name",
      "student",
      "name",
      "studentName",
    ])
  );
};

const resolveSchoolName = (certificate) => {
  if (!certificate) return "";
  return (
    certificate.school_name ||
    readValueByAliases(parseDataJson(certificate.data_json), [
      "school_name",
      "school name",
      "school",
      "institute",
      "schoolName",
    ])
  );
};

const sanitizeFilenamePart = (value, fallback = "certificate") => {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
};

const buildCertificateFilename = (certificate) => {
  const certificateNo = sanitizeFilenamePart(certificate?.certificate_no, "CERT");
  const studentName = sanitizeFilenamePart(certificate?.student_name, "student");
  return `${certificateNo}_${studentName}.png`;
};

export default function Certificates() {
  const { hasPermission } = useAuth();
  const canManageCertificates = hasPermission(PERMISSIONS.MANAGE_CERTIFICATES);

  const [certificates, setCertificates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ student_name: "", school_name: "", data: {} });

  const fetchCertificates = async (
    nextPage = page,
    nextLimit = limit,
    nextTemplateId = selectedTemplateId,
  ) => {
    const templateIdValue = Number.parseInt(nextTemplateId, 10);
    const templateParam = Number.isFinite(templateIdValue) && templateIdValue > 0 ? templateIdValue : undefined;
    const applyTemplateFilter = (rows) => {
      if (!Array.isArray(rows)) return [];
      if (!templateParam) return rows;
      return rows.filter((item) => Number.parseInt(item?.template_id, 10) === templateParam);
    };
    const res = await API.get("/certificates", {
      params: { page: nextPage, limit: nextLimit, template_id: templateParam },
    });
    const payload = res.data;

    if (Array.isArray(payload)) {
      const filteredPayload = applyTemplateFilter(payload);
      const totalItems = filteredPayload.length;
      const normalizedPage = Number(nextPage) > 0 ? Number(nextPage) : 1;
      const normalizedLimit = Number(nextLimit) > 0 ? Number(nextLimit) : 10;
      const offset = (normalizedPage - 1) * normalizedLimit;
      const pageItems = filteredPayload.slice(offset, offset + normalizedLimit);

      setCertificates(pageItems);
      setPage(normalizedPage);
      setLimit(normalizedLimit);
      setTotal(totalItems);
      setTotalPages(Math.max(Math.ceil(totalItems / normalizedLimit), 1));
      return;
    }

    const rawItems = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    const items = applyTemplateFilter(rawItems);
    const totalItems = Number.isFinite(Number(payload?.total))
      ? Number(payload.total)
      : items.length;
    const normalizedPage = Number.isFinite(Number(payload?.page))
      ? Number(payload.page)
      : (Number(nextPage) > 0 ? Number(nextPage) : 1);
    const normalizedLimit = Number.isFinite(Number(payload?.limit))
      ? Number(payload.limit)
      : (Number(nextLimit) > 0 ? Number(nextLimit) : 10);
    const normalizedTotalPages = Number.isFinite(Number(payload?.totalPages))
      ? Number(payload.totalPages)
      : Math.max(Math.ceil(totalItems / normalizedLimit), 1);

    setCertificates(items);
    setPage(normalizedPage);
    setLimit(normalizedLimit);
    setTotal(totalItems);
    setTotalPages(normalizedTotalPages);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        const [templatesRes] = await Promise.all([API.get("/templates")]);
        setTemplates(templatesRes.data || []);
        await fetchCertificates(1, limit, selectedTemplateId);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load certificates");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setError("");
        setLoading(true);
        await fetchCertificates(1, limit, selectedTemplateId);
        setSelectedIds([]);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load certificates");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [limit, selectedTemplateId]);

  const selectedCount = selectedIds.length;
  const allOnPageSelected = certificates.length > 0 && certificates.every((item) => selectedIds.includes(item.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const pageIds = certificates.map((item) => item.id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }

    const pageIds = certificates.map((item) => item.id);
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  };

  const clearSelection = () => setSelectedIds([]);

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSingleDownload = async (certificate) => {
    const response = await API.get(`/certificates/${certificate.id}/download`, { responseType: "blob" });
    downloadBlob(response.data, buildCertificateFilename(certificate));
  };

  const handleBulkDownload = async () => {
    if (!selectedIds.length) return;

    const response = await API.post(
      "/certificates/bulk-download",
      { certificateIds: selectedIds },
      { responseType: "blob" },
    );

    downloadBlob(response.data, "certificates.zip");
  };

  const handleTemplateDownload = async () => {
    const templateIdValue = Number.parseInt(selectedTemplateId, 10);
    if (!Number.isFinite(templateIdValue) || templateIdValue <= 0) return;

    const response = await API.get(`/certificates/template/${templateIdValue}/bulk-download`, {
      responseType: "blob",
    });
    downloadBlob(response.data, `template_${templateIdValue}_certificates.zip`);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected certificate(s)?`);
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");
      await API.post("/certificates/bulk-delete", { certificateIds: selectedIds });
      const nextPage = certificates.length === selectedIds.length && page > 1 ? page - 1 : page;
      await fetchCertificates(nextPage, limit);
      setSelectedIds([]);
      setMessage("Selected certificates deleted");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete selected certificates");
    }
  };

  const searchCertificate = async () => {
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }

    try {
      const res = await API.get(`/certificates/search/${encodeURIComponent(query.trim())}`);
      setSearchResult(res.data);
    } catch {
      setSearchResult({ error: true, message: "Certificate not found" });
    }
  };

  const searchedItems = useMemo(() => {
    if (!searchResult || searchResult.error) return [];
    if (Array.isArray(searchResult?.items)) return searchResult.items;
    if (searchResult?.id) return [searchResult];
    return [];
  }, [searchResult]);

  const startEdit = (certificate) => {
    const data = parseDataJson(certificate.data_json);
    setEditingId(certificate.id);
    setEditForm({
      student_name: resolveStudentName(certificate) || "",
      school_name: resolveSchoolName(certificate) || "",
      data,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ student_name: "", school_name: "", data: {} });
  };

  const saveEdit = async (certificateId) => {
    try {
      setMessage("");
      setError("");
      await API.put(`/certificates/${certificateId}`, {
        student_name: editForm.student_name,
        school_name: editForm.school_name,
        data: editForm.data,
      });
      await fetchCertificates(page, limit);
      setMessage("Certificate updated");
      cancelEdit();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update certificate");
    }
  };

  const deleteCertificate = async (certificateId) => {
    const confirmed = window.confirm("Delete this certificate?");
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");
      await API.delete(`/certificates/${certificateId}`);
      setSelectedIds((prev) => prev.filter((id) => id !== certificateId));
      const nextPage = certificates.length === 1 && page > 1 ? page - 1 : page;
      await fetchCertificates(nextPage, limit);
      setMessage("Certificate deleted");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete certificate");
    }
  };

  const goToPage = async (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;

    try {
      setError("");
      setLoading(true);
      await fetchCertificates(nextPage, limit);
      setSelectedIds([]);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load page");
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => certificates, [certificates]);

  if (loading) return <Loader label="Loading certificates..." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Certificates</h2>
        <p className="text-sm text-slate-500">
          Search, download, bulk export, edit, and delete generated certificates
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-700">Template-wise View</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTemplateId("all")}
            className={`rounded border px-3 py-1 text-sm ${
              selectedTemplateId === "all"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            All Templates
          </button>
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedTemplateId(String(template.id))}
              className={`rounded border px-3 py-1 text-sm ${
                String(selectedTemplateId) === String(template.id)
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              {template.title}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by certificate no, student, school, field_1 or field_2"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={searchCertificate}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        {searchResult && (
          <div className="mt-3 rounded-md border border-slate-200 p-3 text-sm">
            {searchResult.error ? (
              <p className="text-red-600">{searchResult.message}</p>
            ) : (
              <div className="space-y-2">
                {searchedItems.map((item) => (
                  <div
                    key={`search-${item.id}`}
                    className="flex flex-wrap items-center gap-3 rounded border border-slate-200 px-3 py-2"
                  >
                    <p className="font-medium">{resolveStudentName(item) || "N/A"}</p>
                    <p className="text-slate-500">{item.certificate_no}</p>
                    <button
                      type="button"
                      onClick={() => handleSingleDownload(item)}
                      className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAllOnPage}
            disabled={!rows.length}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            {allOnPageSelected ? "Unselect Page" : "Select Page"}
          </button>
          {canManageCertificates && (
            <button
              type="button"
              onClick={handleBulkDownload}
              disabled={!selectedCount}
              className="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:bg-green-300"
            >
              Bulk Download ({selectedCount})
            </button>
          )}
          {canManageCertificates && selectedTemplateId !== "all" && (
            <button
              type="button"
              onClick={handleTemplateDownload}
              className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Download Selected Template
            </button>
          )}
          {canManageCertificates && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={!selectedCount}
              className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:bg-red-300"
            >
              Bulk Delete ({selectedCount})
            </button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            disabled={!selectedCount}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Clear Selection
          </button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-slate-500">Rows:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
                </th>
                <th className="px-3 py-2">Certificate No</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cert) => {
                const isEditing = editingId === cert.id;
                return (
                  <tr key={cert.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(cert.id)}
                        onChange={() => toggleSelect(cert.id)}
                      />
                    </td>
                    <td className="px-3 py-2">{cert.certificate_no}</td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1"
                          value={editForm.student_name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, student_name: e.target.value }))}
                        />
                      ) : (
                        resolveStudentName(cert) || "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1"
                          value={editForm.school_name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, school_name: e.target.value }))}
                        />
                      ) : (
                        resolveSchoolName(cert) || "-"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {cert.created_at ? new Date(cert.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSingleDownload(cert)}
                          className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        >
                          Download
                        </button>
                        {canManageCertificates && !isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(cert)}
                            className="rounded border border-blue-300 px-3 py-1 text-blue-700 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                        )}
                        {canManageCertificates && isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(cert.id)}
                              className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {canManageCertificates && (
                          <button
                            type="button"
                            onClick={() => deleteCertificate(cert.id)}
                            className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!rows.length && <p className="mt-3 text-sm text-slate-500">No certificates available.</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-slate-500">
            Showing page {page} of {totalPages} ({total} total certificates)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
