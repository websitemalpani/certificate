import { useEffect, useState } from "react";
import API from "../api/axios";
import Loader from "../components/Loader";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await API.get("/dashboard/stats");
        setStats(res.data);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <Loader label="Loading dashboard..." />;

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0 },
    { label: "Total Templates", value: stats?.totalTemplates ?? 0 },
    { label: "Total Certificates", value: stats?.totalCertificates ?? 0 },
    { label: "Total Batches", value: stats?.totalBatches ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-slate-500">System activity and recent certificates</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Batch Status</h3>
          <div className="space-y-2 text-sm">
            <p>Pending: {stats?.batchStatus?.pending ?? 0}</p>
            <p>Generating: {stats?.batchStatus?.generating ?? 0}</p>
            <p>Generated: {stats?.batchStatus?.generated ?? 0}</p>
            <p>Partial: {stats?.batchStatus?.partialGenerated ?? 0}</p>
            <p>Failed: {stats?.batchStatus?.failed ?? 0}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Recent Certificates</h3>
          <div className="space-y-2 text-sm">
            {(stats?.recentCertificates || []).map((item) => (
              <div key={item.id} className="rounded border border-slate-100 p-2">
                <p className="font-medium">{item.student_name || "N/A"}</p>
                <p className="text-slate-500">{item.certificate_no}</p>
              </div>
            ))}
            {!stats?.recentCertificates?.length && <p className="text-slate-500">No recent certificates</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
