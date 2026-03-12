import useAuth from "./useAuth";

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm md:hidden"
          >
            Menu
          </button>
          <h1 className="text-base font-semibold text-slate-800 sm:text-lg">Certificate Admin</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-slate-500">Signed in</p>
            <p className="text-sm font-medium text-slate-700">{user?.name || user?.email || "User"}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
