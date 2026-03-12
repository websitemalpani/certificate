import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Navbar onMenuClick={() => setMobileOpen((prev) => !prev)} />

      <div className="mx-auto flex max-w-7xl">
        <div className="hidden md:block md:sticky md:top-16 md:h-[calc(100vh-64px)]">
          <Sidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="h-full w-72" onClick={(e) => e.stopPropagation()}>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="w-full flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
