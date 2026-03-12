import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/axios";
import Loader from "../components/Loader";
import useAuth from "../components/useAuth";
import { PERMISSIONS } from "../utils/permissions";

const terminalStatuses = new Set(["generated", "failed", "partial_generated"]);

export default function BatchProgress() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canManageBatches = hasPermission(PERMISSIONS.MANAGE_BATCHES);
  const canViewCertificates = hasPermission(PERMISSIONS.VIEW_CERTIFICATES);

  const [progress, setProgress] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCertificates, setLoadingCertificates] = useState(true);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");

  const terminal = useMemo(() => terminalStatuses, []);

  const fetchProgress = async () => {
    const res = await API.get(`/batches/${id}/progress`, {
      params: { _t: Date.now() },
    });
    setProgress(res.data);
    return res.data;
  };

  const fetchCertificates = async () => {
    if (!canViewCertificates) {
      setCertificates([]);
      setLoadingCertificates(false);
      return;
    }

    const res = await API.get("/certificates", {
      params: { batch_id: id, _t: Date.now() },
    });
    setCertificates(Array.isArray(res.data) ? res.data : []);
    setLoadingCertificates(false);
  };

  useEffect(() => {
    let stopped = false;
    let timerId = null;

    const loop = async () => {
      try {
        const data = await fetchProgress();
        if (terminal.has(data.status)) {
          stopped = true;
        }
      } finally {
        setLoading(false);
      }

      if (!stopped) {
        timerId = setTimeout(loop, 1200);
      }
    };

    loop();

    return () => {
      stopped = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [id, terminal]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingCertificates(true);
      try {
        await fetchCertificates();
      } catch (_) {
        if (!cancelled) setLoadingCertificates(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [id, canViewCertificates]);

  useEffect(() => {
    if (!progress || !canViewCertificates) return;
    fetchCertificates().catch(() => {});
  }, [id, canViewCertificates, progress?.generated, progress?.status]);

  const startGeneration = async () => {
    setActionError("");
    setStarting(true);
    try {
      await API.post(`/batches/${id}/generate`);
      await fetchProgress();
    } catch (error) {
      setActionError(error?.response?.data?.message || "Failed to start generation. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadBatchCertificates = async () => {
    setActionError("");
    setDownloading(true);
    try {
      const response = await API.get(`/certificates/batch/${id}/bulk-download`, {
        responseType: "blob",
      });
      downloadBlob(response.data, `batch_${id}_certificates.zip`);
    } catch (error) {
      setActionError(
        error?.response?.data?.message || "Failed to download batch certificates.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const statusRows = useMemo(() => {
    if (!progress) return [];

    const generatedRows = certificates.map((certificate, index) => ({
      rowKey: `generated-${certificate.id}`,
      serialNo: index + 1,
      certificateNo: certificate.certificate_no || "-",
      studentName: certificate.student_name || "-",
      schoolName: certificate.school_name || "-",
      status: "generated",
      completion: "100%",
    }));
    const generatedFallbackCount = Math.max(
      Number(progress.generated || 0) - generatedRows.length,
      0,
    );
    const generatedFallbackRows = Array.from(
      { length: generatedFallbackCount },
      (_, index) => ({
        rowKey: `generated-fallback-${index}`,
        serialNo: generatedRows.length + index + 1,
        certificateNo: "-",
        studentName: `Record #${generatedRows.length + index + 1}`,
        schoolName: "-",
        status: "generated",
        completion: "100%",
      }),
    );

    const failedCount = Math.max(Number(progress.failed || 0), 0);
    const pendingCount = Math.max(Number(progress.pending || 0), 0);

    const failedRows = Array.from({ length: failedCount }, (_, index) => ({
      rowKey: `failed-${index}`,
      serialNo: generatedRows.length + generatedFallbackRows.length + index + 1,
      certificateNo: "-",
      studentName: `Record #${generatedRows.length + generatedFallbackRows.length + index + 1}`,
      schoolName: "-",
      status: "failed",
      completion: terminal.has(progress.status) ? "100%" : `${progress.percentage || 0}%`,
    }));

    const pendingRows = Array.from({ length: pendingCount }, (_, index) => ({
      rowKey: `pending-${index}`,
      serialNo:
        generatedRows.length +
        generatedFallbackRows.length +
        failedRows.length +
        index +
        1,
      certificateNo: "-",
      studentName: `Record #${
        generatedRows.length +
        generatedFallbackRows.length +
        failedRows.length +
        index +
        1
      }`,
      schoolName: "-",
      status: "pending",
      completion: `${progress.percentage || 0}%`,
    }));

    return [...generatedRows, ...generatedFallbackRows, ...failedRows, ...pendingRows];
  }, [certificates, progress, terminal]);

  if (loading) return <Loader label="Loading batch progress..." />;
  if (!progress) return <p className="text-red-600">Unable to load batch progress.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Batch Progress #{id}</h2>
        <p className="text-sm text-slate-500">Live polling view for certificate generation</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Status: <span className="capitalize">{progress.status}</span></p>
          <div className="flex items-center gap-2">
            {canManageBatches && (progress.status === "pending" || progress.status === "failed") && (
              <button
                type="button"
                disabled={starting}
                onClick={startGeneration}
                className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-blue-400"
              >
                {starting ? "Starting..." : "Start Generation"}
              </button>
            )}
            {canViewCertificates && Number(progress.generated || 0) > 0 && (
              <button
                type="button"
                disabled={downloading}
                onClick={downloadBatchCertificates}
                className="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:bg-green-400"
              >
                {downloading ? "Downloading..." : "Download Batch Certificates"}
              </button>
            )}
          </div>
        </div>
        {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

        <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress.percentage || 0}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <Stat label="Total" value={progress.totalRecords || 0} />
          <Stat label="Generated" value={progress.generated || 0} />
          <Stat label="Failed" value={progress.failed || 0} />
          <Stat label="Pending" value={progress.pending || 0} />
          <Stat label="Completion" value={`${progress.percentage || 0}%`} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-800">Certificate Status Table</h3>
        </div>

        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Certificate No</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">School</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Completion</th>
            </tr>
          </thead>
          <tbody>
            {statusRows.map((row) => (
              <tr key={row.rowKey} className="border-t border-slate-100">
                <td className="px-4 py-3">{row.serialNo}</td>
                <td className="px-4 py-3">{row.certificateNo}</td>
                <td className="px-4 py-3">{row.studentName}</td>
                <td className="px-4 py-3">{row.schoolName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                      row.status === "generated"
                        ? "bg-green-100 text-green-700"
                        : row.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">{row.completion}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!statusRows.length && !loadingCertificates && (
          <p className="p-4 text-sm text-slate-500">No certificate rows found for this batch yet.</p>
        )}
        {loadingCertificates && (
          <p className="p-4 text-sm text-slate-500">Loading certificate list...</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}
