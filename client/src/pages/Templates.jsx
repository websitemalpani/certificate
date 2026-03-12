import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API, { toStorageUrl } from "../api/axios";
import Loader from "../components/Loader";
import useAuth from "../components/useAuth";
import { PERMISSIONS } from "../utils/permissions";

const defaultForm = {
  title: "",
  qr_x: 900,
  qr_y: 500,
  signature_x: 800,
  signature_y: 600,
  watermark_enabled: true,
  watermark_text: "VERIFIED",
};

export default function Templates() {
  const { hasPermission } = useAuth();
  const canManageTemplates = hasPermission(PERMISSIONS.MANAGE_TEMPLATES);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState(defaultForm);
  const [templateImage, setTemplateImage] = useState(null);
  const [signatureImage, setSignatureImage] = useState(null);

  const fetchTemplates = async () => {
    const res = await API.get("/templates");
    setTemplates(res.data || []);
  };

  useEffect(() => {
    const run = async () => {
      try {
        await fetchTemplates();
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const canSubmit = useMemo(() => form.title.trim() && templateImage, [form.title, templateImage]);

  const handleCreateTemplate = async (event) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Title and template image are required");
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("title", form.title.trim());
      payload.append("qr_x", String(form.qr_x));
      payload.append("qr_y", String(form.qr_y));
      payload.append("signature_x", String(form.signature_x));
      payload.append("signature_y", String(form.signature_y));
      payload.append("watermark_enabled", String(form.watermark_enabled));
      payload.append("watermark_text", form.watermark_text);
      payload.append("templateImage", templateImage);

      if (signatureImage) {
        payload.append("signatureImage", signatureImage);
      }

      await API.post("/templates", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setForm(defaultForm);
      setTemplateImage(null);
      setSignatureImage(null);
      await fetchTemplates();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete this template?");
    if (!confirmed) return;

    await API.delete(`/templates/${id}`);
    await fetchTemplates();
  };

  if (loading) return <Loader label="Loading templates..." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Templates</h2>
        <p className="text-sm text-slate-500">Create and manage certificate templates</p>
        <div className="mt-2">
          <a
            href="/sample-certificates.csv"
            download="sample-certificates.csv"
            className="inline-flex rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
          >
            Download Sample CSV
          </a>
        </div>
      </div>

      {canManageTemplates ? (
        <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Create Template</h3>
            {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <input
              placeholder="Template title"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />

            <label className="block text-sm font-medium">Template image</label>
            <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setTemplateImage(e.target.files?.[0] || null)} required />

            <label className="block text-sm font-medium">Signature image (optional)</label>
            <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => setSignatureImage(e.target.files?.[0] || null)} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>
              <span className="mb-1 block">QR X</span>
              <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.qr_x} onChange={(e) => setForm((p) => ({ ...p, qr_x: Number(e.target.value) }))} />
            </label>
            <label>
              <span className="mb-1 block">QR Y</span>
              <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.qr_y} onChange={(e) => setForm((p) => ({ ...p, qr_y: Number(e.target.value) }))} />
            </label>
            <label>
              <span className="mb-1 block">Signature X</span>
              <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.signature_x} onChange={(e) => setForm((p) => ({ ...p, signature_x: Number(e.target.value) }))} />
            </label>
            <label>
              <span className="mb-1 block">Signature Y</span>
              <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.signature_y} onChange={(e) => setForm((p) => ({ ...p, signature_y: Number(e.target.value) }))} />
            </label>
            <label className="col-span-2">
              <span className="mb-1 block">Watermark text</span>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={form.watermark_text} onChange={(e) => setForm((p) => ({ ...p, watermark_text: e.target.value }))} />
            </label>
            <label className="col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={form.watermark_enabled} onChange={(e) => setForm((p) => ({ ...p, watermark_enabled: e.target.checked }))} />
              Enable watermark
            </label>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="col-span-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {submitting ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {tpl.image_path && (
              <img src={toStorageUrl(tpl.image_path)} alt={tpl.title} className="h-44 w-full object-cover" />
            )}
            <div className="space-y-2 p-4">
              <h3 className="font-semibold text-slate-800">{tpl.title}</h3>
              <p className="text-xs text-slate-500">ID: {tpl.id}</p>
              <div className="flex items-center gap-3 text-sm">
                {canManageTemplates && (
                  <>
                    <Link to={`/template-editor/${tpl.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                      Edit Fields
                    </Link>
                    <button type="button" className="font-medium text-red-600 hover:text-red-700" onClick={() => handleDelete(tpl.id)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!templates.length && <p className="text-sm text-slate-500">No templates available.</p>}
    </div>
  );
}
