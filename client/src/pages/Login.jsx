import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../components/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h1 className="mb-1 text-2xl font-bold text-slate-800">User Login</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in with your backend credentials.</p>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="admin@example.com"
        />

        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-5 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="********"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <div className="mt-4 text-center text-sm">
          <Link to="/public-certificates" className="text-blue-600 hover:text-blue-700">
            Public certificate download
          </Link>
        </div>
      </form>
    </div>
  );
}
