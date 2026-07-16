import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { socket } from '../socket';
import { ShieldPlus, Phone, ActivitySquare, LifeBuoy } from 'lucide-react';

export default function Rescue() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  // Registration form state
  const [showRegForm, setShowRegForm] = useState(false);
  const [regData, setRegData] = useState({
    name: '', age: '', contactNumber: '', lat: '', lng: '', mobilityIssues: false, medicalConditions: ''
  });

  const fetchQueue = async () => {
    try {
      const res = await api.get('/api/rescue/queue');
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();

    socket.on('rescue-queue:update', fetchQueue);

    const checkPolling = () => {
      if (socket.connected) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchQueue, 15000);
        }
      }
    };

    socket.on('connect', checkPolling);
    socket.on('disconnect', checkPolling);

    checkPolling();

    return () => {
      socket.off('rescue-queue:update', fetchQueue);
      socket.off('connect', checkPolling);
      socket.off('disconnect', checkPolling);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleClaim = async (taskId) => {
    if (!user) {
      alert('You must be logged in as rescue personnel to claim tasks.');
      return;
    }
    try {
      await api.patch(`/api/rescue/claim/${taskId}`);
      fetchQueue();
    } catch (err) {
      console.error(err);
      alert('Failed to claim task');
    }
  };

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      await api.patch(`/api/rescue/status/${taskId}`, { status: newStatus });
      fetchQueue();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: regData.name,
        age: parseInt(regData.age),
        contactNumber: regData.contactNumber,
        location: { lat: parseFloat(regData.lat), lng: parseFloat(regData.lng) },
        mobilityIssues: regData.mobilityIssues,
        medicalConditions: regData.medicalConditions.split(',').map(s => s.trim()).filter(Boolean)
      };
      await api.post('/api/rescue/register', data);
      setShowRegForm(false);
      setRegData({ name: '', age: '', contactNumber: '', lat: '', lng: '', mobilityIssues: false, medicalConditions: '' });
      fetchQueue();
      alert('Registration successful');
    } catch (err) {
      console.error(err);
      alert('Failed to register');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-800 tracking-tight flex items-center gap-2">
          <LifeBuoy className="w-7 h-7 text-blue-600" />
          Rescue Dashboard
        </h1>
        <button
          onClick={() => setShowRegForm(!showRegForm)}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors flex items-center gap-2 shadow-sm"
        >
          <ShieldPlus className="w-4 h-4" />
          {showRegForm ? 'Close Form' : 'Register Vulnerable Person'}
        </button>
      </div>

      {showRegForm && (
        <form onSubmit={handleRegister} className="bg-white p-4 rounded shadow mb-8 space-y-4">
          <h2 className="font-bold text-lg">Registration Form</h2>
          <div className="grid grid-cols-2 gap-4">
            <input required type="text" placeholder="Name" className="border p-2 rounded" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
            <input required type="number" placeholder="Age" className="border p-2 rounded" value={regData.age} onChange={e => setRegData({...regData, age: e.target.value})} />
            <input required type="text" placeholder="Contact Number" className="border p-2 rounded" value={regData.contactNumber} onChange={e => setRegData({...regData, contactNumber: e.target.value})} />
            <input type="text" placeholder="Medical Conditions (comma separated)" className="border p-2 rounded" value={regData.medicalConditions} onChange={e => setRegData({...regData, medicalConditions: e.target.value})} />
            <input required type="number" step="any" placeholder="Latitude" className="border p-2 rounded" value={regData.lat} onChange={e => setRegData({...regData, lat: e.target.value})} />
            <input required type="number" step="any" placeholder="Longitude" className="border p-2 rounded" value={regData.lng} onChange={e => setRegData({...regData, lng: e.target.value})} />
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={regData.mobilityIssues} onChange={e => setRegData({...regData, mobilityIssues: e.target.checked})} />
              <span>Has Mobility Issues</span>
            </label>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Submit Registration</button>
        </form>
      )}

      {loading ? (
        <p>Loading queue...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Priority</th>
                <th className="p-3">Person</th>
                <th className="p-3">Location / Zone</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8">
                    <div className="flex flex-col items-center justify-center text-center space-y-3 py-12">
                      <span className="text-5xl" role="img" aria-label="Lifebuoy">🛟</span>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">No active rescue tasks</h3>
                        <p className="text-gray-500 mt-1">Everyone is currently safe and accounted for.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {tasks.map(task => (
                <tr key={task._id} className="border-b">
                  <td className="p-3 font-bold text-red-600">{task.priorityScore}</td>
                  <td className="p-3">
                    <p className="font-semibold">{task.personId?.name}</p>
                    <p className="text-xs text-gray-500">Age: {task.personId?.age} | {task.personId?.contactNumber}</p>
                    {task.personId?.mobilityIssues && <span className="text-xs bg-red-100 text-red-800 px-1 rounded mr-1">Mobility</span>}
                    
                    {task.personId?.emergencyContact?.phone && (
                      <div className="mt-2 pt-2 border-t text-sm">
                        <span className="font-medium">Emergency Contact:</span> {task.personId.emergencyContact.name} - {task.personId.emergencyContact.phone}
                        <div className="mt-1">
                          {/* 
                              Intentionally using a plain tel: link instead of automatic emergency dialing API.
                              This ensures a human dispatcher controls the call initiation, preventing
                              accidental automated spam to emergency services or individuals during a crisis.
                          */}
                          <a 
                            href={`tel:${task.personId.emergencyContact.phone.replace(/[^0-9+]/g, '')}`} 
                            className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 transition-colors shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call Contact
                          </a>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {task.personId?.location.lat.toFixed(4)}, {task.personId?.location.lng.toFixed(4)}
                    {task.dangerZoneId && (
                      <p className="text-red-700 text-xs">In {task.dangerZoneId.severity} danger zone</p>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {task.status.toUpperCase()}
                    </span>
                    {task.assignedTo && <p className="text-xs mt-1 text-gray-600">Assigned: {task.assignedTo.name}</p>}
                  </td>
                  <td className="p-3">
                    {task.status === 'pending' && (
                      <button onClick={() => handleClaim(task._id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Claim</button>
                    )}
                    {task.status === 'assigned' && task.assignedTo?._id === user?._id && (
                      <button onClick={() => handleStatusUpdate(task._id, 'rescued')} className="bg-green-700 text-white px-3 py-1 rounded text-sm hover:bg-green-800">Mark Rescued</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
