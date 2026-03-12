export default function Loader({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}
