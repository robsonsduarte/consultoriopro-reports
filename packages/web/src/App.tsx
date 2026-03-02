import { Routes, Route, Navigate } from 'react-router-dom';

function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ConsultorioPro Reports</h1>
        <p className="text-gray-500 mb-4">Ambiente de desenvolvimento pronto</p>
        <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-800">
          <p className="font-semibold">Status: Online</p>
          <p>Frontend: Vite + React 19 + Tailwind v4</p>
          <p>Backend: Hono + Drizzle + PostgreSQL</p>
        </div>
        <div className="mt-4">
          <a
            href="/api/health"
            target="_blank"
            className="text-blue-600 hover:underline text-sm"
          >
            Verificar API /health
          </a>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
