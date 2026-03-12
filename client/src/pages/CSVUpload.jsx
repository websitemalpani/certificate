import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import Loader from "../components/Loader";

export default function CSVUpload() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [batches, setBatches] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatingBatchId, setGeneratingBatchId] = useState(null);
  const [removingBatchId, setRemovingBatchId] = useState(null);
  const [error, setError] = useState("");
  const [createdBatch, setCreatedBatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInitial = async () => {
    const [tplRes, batchRes] = await Promise.all([API.get("/templates"), API.get("/batches")]);
    setTemplates(tplRes.data || []);
    setBatches(batchRes.data || []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await fetchInitial();
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const uploadFile = async () => {
    setError("");

    if (!templateId || !file) {
      setError("Please select template and CSV file");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("template_id", templateId);
      formData.append("file", file);

      const res = await API.post("/batches/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCreatedBatch(res.data);
      await fetchInitial();
      setFile(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const generateBatch = async (batchId) => {
    setError("");
    setGeneratingBatchId(batchId);
    try {
      await API.post(`/batches/${batchId}/generate`);
      navigate(`/batch-progress/${batchId}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to start generation");
    } finally {
      setGeneratingBatchId(null);
    }
  };

  const removeBatch = async (batchId) => {
    const confirmed = window.confirm(`Remove batch #${batchId}? This will delete generated certificates for this batch.`);
    if (!confirmed) return;

    setError("");
    setRemovingBatchId(batchId);
    try {
      await API.delete(`/batches/${batchId}`);
      setBatches((prev) => prev.filter((batch) => batch.id !== batchId));
      if (createdBatch?.batchId === batchId) {
        setCreatedBatch(null);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to remove batch");
    } finally {
      setRemovingBatchId(null);
    }
  };

  if (loading) return <Loader label="Loading upload panel..." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">CSV Upload</h2>
        <p className="text-sm text-slate-500">Upload CSV, then start certificate generation</p>
        <p className="text-xs text-slate-500">
          CSV headers can be anything. System maps columns by order: 1st to <code>field_1</code>, 2nd to <code>field_2</code>, 3rd to <code>field_3</code>.
        </p>
        <p className="text-xs text-slate-500">
          Include <code>mobile</code> and <code>email</code> columns if you need public certificate download lookup.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            className="rounded-md border border-slate-300 px-3 py-2"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select Template</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.title} (ID: {tpl.id})
              </option>
            ))}
          </select>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />

          <button
            type="button"
            disabled={uploading}
            onClick={uploadFile}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {uploading ? "Uploading..." : "Upload CSV"}
          </button>
        </div>

        {createdBatch?.batchId && (
          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            <p>Batch created: #{createdBatch.batchId}</p>
            <p>Total records: {createdBatch.totalRecords}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => generateBatch(createdBatch.batchId)}
                className="rounded-md bg-green-600 px-3 py-1 text-white hover:bg-green-700"
              >
                Generate Now
              </button>
              <Link className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50" to={`/batch-progress/${createdBatch.batchId}`}>
                View Progress
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Records</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-slate-100">
                <td className="px-4 py-3">#{batch.id}</td>
                <td className="px-4 py-3">{batch.template_id}</td>
                <td className="px-4 py-3">{batch.total_records}</td>
                <td className="px-4 py-3">{batch.status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {(batch.status === "pending" || batch.status === "failed") && (
                      <button
                        type="button"
                        disabled={generatingBatchId === batch.id}
                        onClick={() => generateBatch(batch.id)}
                        className="rounded bg-blue-600 px-3 py-1 text-white"
                      >
                        {generatingBatchId === batch.id ? "Generating..." : "Generate"}
                      </button>
                    )}
                    <Link to={`/batch-progress/${batch.id}`} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50">
                      Progress
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeBatch(batch.id)}
                      disabled={removingBatchId === batch.id || batch.status === "generating"}
                      className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      {removingBatchId === batch.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!batches.length && <p className="p-4 text-sm text-slate-500">No batches yet.</p>}
      </div>
    </div>
  );
}
