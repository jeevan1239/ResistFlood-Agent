import { useState } from 'react';
import api from '../api/axios';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function LocationSelector({ setLocation }) {
  useMapEvents({
    click(e) {
      setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function Report() {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [locError, setLocError] = useState('');

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocError('');
      },
      () => {
        setLocError('Unable to retrieve your location');
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !location) {
      setError('Please provide an image and location.');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('lat', location.lat);
    formData.append('lng', location.lng);
    formData.append('note', note);

    try {
      await api.post('/api/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto p-4 mt-8 text-center bg-white rounded shadow">
        <h2 className="text-2xl font-bold text-green-600 mb-4">Report Submitted!</h2>
        <p className="text-gray-600 mb-6">Thank you for reporting. AI is verifying the severity.</p>
        <button
          onClick={() => { setSuccess(false); setFile(null); setNote(''); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 mt-8 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Report Flood</h2>
      {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <div className="border rounded relative overflow-hidden bg-gray-50 h-48 mb-2">
            <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationSelector setLocation={setLocation} />
              {location && <Marker position={[location.lat, location.lng]} />}
            </MapContainer>
            <div className="absolute top-2 right-2 bg-white px-2 py-1 text-xs font-bold rounded shadow z-[1000] pointer-events-none">
              Tap map to select location
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={getLocation}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
            >
              Use My Device GPS
            </button>
            {location && (
              <span className="text-sm text-green-600 font-medium">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            )}
          </div>
          {locError && <p className="text-red-500 text-xs mt-1">{locError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Note (Optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-2 border rounded"
            rows="3"
            placeholder="e.g. Water is above knee level"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !file || !location || isNaN(location.lat) || isNaN(location.lng)}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
