import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';
import { socket } from '../socket.js';
import { motion, useSpring, useTransform } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity as ActivityIcon, ShieldAlert, HeartPulse, Server, LayoutDashboard, FileText, ShieldCheck, Search } from 'lucide-react';

// A component that animates its number when the value changes
function AnimatedCounter({ value }) {
  const spring = useSpring(value, { type: "spring", bounce: 0, duration: 0.8 });
  const display = useTransform(spring, (current) => Math.floor(current));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

function StatCard({ label, value, loading, index }) {
  // Stagger entrance using the index
  return (
    <motion.div 
      initial={{ opacity: 1, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
      className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col"
    >
      <span className="text-gray-600 text-xs font-semibold uppercase tracking-wider">{label}</span>
      {loading ? (
        <div className="h-9 bg-gray-100 animate-pulse rounded mt-2 w-16"></div>
      ) : (
        <span className="text-3xl font-bold text-gray-800 mt-1 tracking-tight">
          <AnimatedCounter value={value} />
        </span>
      )}
    </motion.div>
  );
}

function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({ sensors: [], reports: [], rescue: [], zones: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch basic stats
        const statsRes = await api.get('/api/admin/stats');
        const statsData = statsRes.data;
        
        // Fetch data for charts
        const [sensorsRes, reportsRes, rescueRes, zonesRes] = await Promise.all([
          api.get('/api/sensors/latest'),
          api.get('/api/reports'),
          api.get('/api/rescue/queue'),
          api.get('/api/danger-zones/active')
        ]);

        const sensors = sensorsRes.data;
        const reports = reportsRes.data;
        const rescue = rescueRes.data;
        const zones = zonesRes.data;

        setStats(statsData);

        // Process Chart Data
        const sensorChart = sensors.map(s => ({
          name: s.deviceId.substring(0, 5),
          waterLevel: s.waterLevel
        }));

        const reportStatus = [
          { name: 'Pending', count: reports.filter(r => r.status === 'pending').length },
          { name: 'Verified', count: reports.filter(r => r.status === 'verified').length },
          { name: 'Rejected', count: reports.filter(r => r.status === 'rejected').length },
        ];

        const rescueStatus = [
          { name: 'Pending', count: rescue.filter(r => r.status === 'pending').length },
          { name: 'Assigned', count: rescue.filter(r => r.status === 'assigned').length },
          { name: 'Rescued', count: rescue.filter(r => r.status === 'rescued').length },
        ];

        const zoneSeverity = [
          { name: 'Low', count: zones.filter(z => z.severity === 'low').length },
          { name: 'Medium', count: zones.filter(z => z.severity === 'medium').length },
          { name: 'High', count: zones.filter(z => z.severity === 'high').length },
        ];

        setChartData({ sensors: sensorChart, reports: reportStatus, rescue: rescueStatus, zones: zoneSeverity });
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch admin data', err);
        setLoading(false);
      }
    };

    fetchData();
    
    const handleStatsUpdate = (newStats) => {
      if (newStats) {
        setStats(newStats);
        // We could selectively update charts here, but for simplicity we rely on polling or full refresh if needed
      }
      else fetchData(); 
    };
    socket.on('admin:stats-update', handleStatsUpdate);

    return () => socket.off('admin:stats-update', handleStatsUpdate);
  }, []);

  const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Total Flood Reports" value={stats?.totalFloodReports ?? 0} loading={loading} />
        <StatCard index={1} label="Verified Reports" value={stats?.verifiedReports ?? 0} loading={loading} />
        <StatCard index={2} label="Rejected Reports" value={stats?.rejectedReports ?? 0} loading={loading} />
        <StatCard index={3} label="Active Danger Zones" value={stats?.activeDangerZones ?? 0} loading={loading} />
        
        <StatCard index={4} label="Active Rescue Tasks" value={stats?.activeRescueTasks ?? 0} loading={loading} />
        <StatCard index={5} label="Completed Rescues" value={stats?.completedRescueTasks ?? 0} loading={loading} />
        <StatCard index={6} label="Registered Vulnerable" value={stats?.registeredVulnerablePeople ?? 0} loading={loading} />
        
        <StatCard index={7} label="Active Sensors" value={stats?.activeSensors ?? 0} loading={loading} />
        <StatCard index={8} label="Connected Clients" value={stats?.connectedClients ?? 0} loading={loading} />
        <StatCard index={9} label="Uptime (s)" value={Math.floor(stats?.serverUptime ?? 0)} loading={loading} />
      </div>

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 1, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><ActivityIcon className="w-4 h-4 text-blue-500" /> Sensor Water Levels (m)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.sensors}>
                  <defs>
                    <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} width={30} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="waterLevel" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorWater)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 1, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-500" /> Report Status</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.reports} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.reports.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 1, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><HeartPulse className="w-4 h-4 text-red-500" /> Rescue Tasks</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.rescue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis hide />
                  <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                    {chartData.rescue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 1, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-orange-500" /> Danger Zones Severity</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.zones} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.zones.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'High' ? '#ef4444' : entry.name === 'Medium' ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get('/api/admin/logs?limit=50')
    .then(res => res.data)
    .then(data => {
      setLogs(data);
      setLoading(false);
    });

    const handleNotification = (newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 50));
    };
    socket.on('notification', handleNotification);

    return () => socket.off('notification', handleNotification);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
        <ActivityIcon className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-800 tracking-tight">Live Event Timeline</h3>
      </div>
      <div className="p-6">
        <div className="relative border-l-2 border-blue-100 ml-3">
          {loading ? (
            // Skeleton loading for activity logs
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mb-6 ml-6 relative animate-pulse">
                <span className="absolute -left-9 top-1 bg-gray-200 border-2 border-gray-100 w-4 h-4 rounded-full"></span>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-3/4"></div>
              </div>
            ))
          ) : (
            logs.map((log) => (
              <motion.div 
                key={log._id} 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", bounce: 0 }}
                className="mb-6 ml-6 relative"
              >
                <span className="absolute -left-9 top-1 bg-white border-2 border-blue-400 w-4 h-4 rounded-full"></span>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-bold text-blue-700">{log.eventType.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-400 font-medium">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-snug">{log.description}</p>
                {log.userId && (
                  <p className="text-xs text-gray-400 mt-1">User: {log.userId.name}</p>
                )}
              </motion.div>
            ))
          )}
          {!loading && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center space-y-3 py-10 ml-[-24px]">
              <span className="text-4xl" role="img" aria-label="Clipboard">📋</span>
              <div>
                <h3 className="text-sm font-bold text-gray-800">No activity recorded yet</h3>
                <p className="text-xs text-gray-500 mt-1">Actions will appear here as they happen.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Health() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get('/api/admin/health')
    .then(res => res.data)
    .then(data => setHealth(data));
  }, []);

  if (!health) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="animate-pulse h-48 bg-white border border-gray-100 rounded-xl shadow-sm"></div>
        <div className="animate-pulse h-48 bg-white border border-gray-100 rounded-xl shadow-sm"></div>
      </div>
    );
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0, duration: 0.4 } },
    hover: { y: -2, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <motion.div 
        variants={cardVariants} initial="hidden" animate="visible" whileHover="hover"
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
      >
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2 tracking-tight">System Resources</h3>
        <ul className="space-y-3 text-sm">
          <li className="flex justify-between"><span className="text-gray-500">Node Version</span><span className="font-mono text-gray-700">{health.nodeVersion}</span></li>
          <li className="flex justify-between"><span className="text-gray-500">RSS Memory</span><span className="font-mono text-gray-700">{health.memory.rss}</span></li>
          <li className="flex justify-between"><span className="text-gray-500">Heap Used</span><span className="font-mono text-gray-700">{health.memory.heapUsed}</span></li>
          <li className="flex justify-between"><span className="text-gray-500">Database</span><span className={`font-mono font-medium ${health.database === 'connected' ? 'text-green-600' : 'text-red-600'}`}>{health.database}</span></li>
          <li className="flex justify-between"><span className="text-gray-500">Upload Folder Size</span><span className="font-mono text-gray-700">{health.storage.uploadFolderSize}</span></li>
        </ul>
      </motion.div>

      <motion.div 
        variants={cardVariants} initial="hidden" animate="visible" whileHover="hover"
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
      >
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2 tracking-tight">Service Status</h3>
        <ul className="space-y-3 text-sm">
          <li className="flex justify-between">
            <span className="text-gray-500">Gemini Status</span>
            <span className={`font-medium ${health.gemini.configured ? 'text-green-600' : 'text-red-600'}`}>
              {health.gemini.configured ? '✓ Configured' : 'Missing API Key'}
            </span>
          </li>
          {health.gemini.configured && (
            <>
              <li className="flex justify-between">
                <span className="text-gray-500">Last Gemini Call</span>
                <span className="text-gray-700">{health.gemini.lastSuccessfulCall ? new Date(health.gemini.lastSuccessfulCall).toLocaleString() : 'None'}</span>
              </li>
              {health.gemini.lastError && (
                <li className="flex justify-between flex-col">
                  <span className="text-gray-500">Last Gemini Error</span>
                  <span className="text-red-500 text-xs mt-1 bg-red-50 p-2 rounded">{health.gemini.lastError}</span>
                </li>
              )}
            </>
          )}
          <li className="flex justify-between pt-2 border-t mt-2">
            <span className="text-gray-500">Total API Requests</span>
            <span className="font-mono text-gray-700">{health.requests.total}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-500">Avg Response Time</span>
            <span className="font-mono text-gray-700">{health.requests.avgResponseTimeMs} ms</span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'Overview';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-lg shadow-sm">
          Access Denied. Admin privileges required.
        </div>
      </div>
    );
  }

  const TABS = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Activity', icon: ActivityIcon },
    { name: 'Health', icon: Server }
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Operations Dashboard
          </h1>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
            <Search className="w-4 h-4" />
            <span>Press <kbd className="font-mono bg-gray-100 text-gray-700 px-1 rounded">Ctrl+K</kbd> to search</span>
          </div>
        </div>
        
        <div className="flex gap-2 mb-8">
          {TABS.map(tab => (
            <motion.button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              whileTap={{ scale: 0.96 }}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.name 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.name ? 'text-blue-200' : 'text-gray-400'}`} />
              {tab.name}
            </motion.button>
          ))}
        </div>

        <div>
          {activeTab === 'Overview' && <Overview />}
          {activeTab === 'Activity' && <Activity />}
          {activeTab === 'Health' && <Health />}
        </div>
      </div>
    </div>
  );
}
