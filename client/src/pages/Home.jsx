import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';

export default function Home() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/api/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-blue-700 mb-2">ResistFlood</h1>
      <p className="text-gray-500 mb-8 text-center max-w-md">
        Real-time flood monitoring &amp; rescue coordination for Bengaluru.
      </p>

      {user && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2 mb-6">
          Signed in as <strong>{user.name}</strong> ({user.role})
        </p>
      )}

      <div className="bg-white rounded-xl shadow p-6 w-full max-w-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">API Health Check</h2>
        {health ? (
          <pre className="bg-gray-100 rounded p-3 text-sm text-green-700">
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : (
          <p className="text-gray-400 text-sm">Checking server…</p>
        )}
      </div>

      {!user && (
        <Link
          to="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2 text-sm transition-colors"
        >
          Get started →
        </Link>
      )}
    </div>
  );
}
