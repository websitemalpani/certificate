import { useState } from "react";
import API from "../api/axios";

export default function PublicCertificateLookup() {
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const normalizeMobile = (value) => String(value || "").replace(/\D/g, "");

  const handleLookup = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setItems([]);
    setLoading(true);

    try {
      const res = await API.post("/certificates/public/lookup", {
        mobile: normalizeMobile(mobile),
        email: String(email || "").trim().toLowerCase(),
      });
      const nextItems = res.data?.items || [];
      setItems(nextItems);
      if (!nextItems.length) {
        setMessage("No certificates found.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to find certificates.");
    } finally {
      setLoading(false);
    }
  };

  const downloadCertificate = async (id) => {
    setError("");
    setDownloadingId(id);
    try {
      const query = new URLSearchParams({
        mobile: normalizeMobile(mobile),
        email: String(email || "").trim().toLowerCase(),
      });
      const response = await API.get(`/certificates/public/download/${id}?${query.toString()}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `certificate_${id}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to download certificate.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800">Download Your Certificate</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your mobile number or email used during registration.
          </p>

          <form onSubmit={handleLookup} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Mobile number (optional)"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Searching..." : "Find Certificate"}
            </button>
          </form>

          {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>}
        </div>

        {!!items.length && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Available Certificates</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Certificate No</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{item.certificate_no}</td>
                      <td className="px-3 py-2">{item.student_name || "-"}</td>
                      <td className="px-3 py-2">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => downloadCertificate(item.id)}
                          disabled={downloadingId === item.id}
                          className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
                        >
                          {downloadingId === item.id ? "Downloading..." : "Download"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
