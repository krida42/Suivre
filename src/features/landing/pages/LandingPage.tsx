import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <h1 className="text-4xl font-bold mb-4">Welcome to SuiFan</h1>
      <p className="mb-8 text-slate-400">The decentralized creator platform</p>
      <Link to="/app" className="px-6 py-3 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors font-medium">
        Launch App
      </Link>
    </div>
  );
}
