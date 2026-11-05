import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  Monitor, Laptop, Plus, RefreshCw, Trash2, Edit3, 
  Play, CheckCircle2, XCircle, Search, Folder, Copy, 
  Check, Loader2, ShieldCheck, X, HardDrive, Wifi, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Device {
  id: string;
  device_key: string;
  name: string;
  hostname: string;
  os_info: string;
  platform: string;
  ip_address?: string;
  group: string;
  status: 'online' | 'offline' | 'in-session';
  registered_by: string;
  registered_by_name?: string;
  last_seen: string;
  created_at: string;
}

const DevicesList = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All');
  
  // Modals state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000); // Polling status every 15s
    return () => clearInterval(interval);
  }, [selectedGroup]);

  const fetchDevices = async () => {
    try {
      const params: any = {};
      if (selectedGroup !== 'All') params.group = selectedGroup;
      const res = await api.get('/devices', { params });
      setDevices(res.data);
    } catch {
      toast.error('Failed to load unattended computers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (device: Device) => {
    if (device.status === 'offline') {
      toast.error('Device is currently offline. Wait until it reconnects.');
      return;
    }
    setIsConnecting(device.id);
    try {
      const res = await api.post(`/devices/${device.id}/connect`);
      toast.success(`Unattended session created for ${device.name}`);
      navigate(`/room/${res.data.session_code}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to connect to unattended device');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove unattended computer "${name}"?`)) return;
    try {
      await api.delete(`/devices/${id}`);
      setDevices(prev => prev.filter(d => d.id !== id));
      toast.success('Device removed successfully');
    } catch {
      toast.error('Failed to remove device');
    }
  };

  const openEditModal = (dev: Device) => {
    setEditingDevice(dev);
    setEditName(dev.name);
    setEditGroup(dev.group || 'Default');
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    try {
      const res = await api.put(`/devices/${editingDevice.id}`, {
        name: editName,
        group: editGroup
      });
      setDevices(prev => prev.map(d => d.id === editingDevice.id ? res.data : d));
      toast.success('Device updated');
      setShowEditModal(false);
    } catch {
      toast.error('Failed to update device');
    }
  };

  const groups = ['All', ...Array.from(new Set(devices.map(d => d.group || 'Default')))];

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (d.ip_address && d.ip_address.includes(searchQuery));
    const matchesGroup = selectedGroup === 'All' || d.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const onlineCount = devices.filter(d => d.status === 'online').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-indigo-500" />
            Unattended Computers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage and access registered remote computers anytime without end-user presence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setIsLoading(true); fetchDevices(); }}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title="Refresh devices"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Deploy New Computer
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{devices.length}</div>
            <div className="text-xs text-gray-500">Total Configured Computers</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{onlineCount}</div>
            <div className="text-xs text-gray-500">Online & Ready to Connect</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{devices.length - onlineCount}</div>
            <div className="text-xs text-gray-500">Offline Computers</div>
          </div>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by computer name, hostname or IP..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Group:</span>
          {groups.map(grp => (
            <button
              key={grp}
              onClick={() => setSelectedGroup(grp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedGroup === grp
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            Loading unattended computers...
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
            <Monitor className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No computers found</p>
            <p className="text-sm mt-1">Deploy an unattended agent installer on a remote machine to get started.</p>
            <button
              onClick={() => setShowDeployModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Add First Computer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-750 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Computer Name</th>
                  <th className="px-6 py-4 font-semibold">OS / Hostname</th>
                  <th className="px-6 py-4 font-semibold">IP Address</th>
                  <th className="px-6 py-4 font-semibold">Group</th>
                  <th className="px-6 py-4 font-semibold">Last Seen</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredDevices.map(device => {
                  const isOnline = device.status === 'online';
                  return (
                    <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isOnline 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-indigo-500" />
                          <span>{device.name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div>{device.os_info || 'Windows'}</div>
                        <div className="text-gray-400 font-mono text-[11px]">{device.hostname}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                        {device.ip_address || '—'}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          <Folder className="w-3 h-3 text-gray-400" />
                          {device.group || 'Default'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {new Date(device.last_seen).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleConnect(device)}
                            disabled={!isOnline || isConnecting === device.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                              isOnline
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                            title={isOnline ? 'Connect to remote desktop now' : 'Device is offline'}
                          >
                            {isConnecting === device.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>Connect</span>
                          </button>

                          <button
                            onClick={() => openEditModal(device)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Edit computer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(device.id, device.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Remove computer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deploy Agent Modal */}
      <AnimatePresence>
        {showDeployModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-5"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Deploy Unattended Remote Access</span>
                </div>
                <button 
                  onClick={() => setShowDeployModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300">
                To configure permanent unattended remote desktop access on a target computer, install the RemoteAssist Unattended Agent.
              </p>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Quick Install Command (Windows PowerShell Admin)
                </div>
                <div className="relative">
                  <pre className="bg-gray-900 text-indigo-300 p-3 rounded-lg text-xs font-mono overflow-x-auto select-all">
                    curl -sSL "https://remote-assist-y8ot.onrender.com/api/sessions/latest/download" -o "$env:TEMP\RemoteAssist.exe"; Start-Process "$env:TEMP\RemoteAssist.exe" -ArgumentList "--unattended"
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`curl -sSL "https://remote-assist-y8ot.onrender.com/api/sessions/latest/download" -o "$env:TEMP\\RemoteAssist.exe"; Start-Process "$env:TEMP\\RemoteAssist.exe" -ArgumentList "--unattended"`);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2000);
                      toast.success('Command copied to clipboard');
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                    title="Copy to clipboard"
                  >
                    {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300">
                <strong>Zoho Assist Security Note:</strong> Unattended devices communicate using encrypted TLS heartbeat tokens. Only authorized technicians in your organization can initiate connections.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Device Modal */}
      <AnimatePresence>
        {showEditModal && editingDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">Edit Computer Details</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Computer Friendly Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Department / Group
                  </label>
                  <input
                    type="text"
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    placeholder="e.g. Finance, Support, IT Dept"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DevicesList;

