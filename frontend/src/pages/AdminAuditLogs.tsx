import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, Search, Download, RefreshCw, Loader2, 
  Clock, Filter, Key, FileText, Monitor, ShieldAlert 
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  session_code?: string;
  device_id?: string;
  ip_address?: string;
}

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const fetchLogs = async () => {
    try {
      const params: any = { limit: 200 };
      if (actionFilter !== 'all') params.action = actionFilter;
      const res = await api.get('/audit-logs', { params });
      setLogs(res.data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs available to export');
      return;
    }
    const headers = ['Timestamp', 'Action', 'User', 'Email', 'Role', 'Session Code', 'IP Address', 'Details'];
    const rows = logs.map(l => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.action}"`,
      `"${l.user_name || 'System'}"`,
      `"${l.user_email || ''}"`,
      `"${l.user_role || ''}"`,
      `"${l.session_code || ''}"`,
      `"${l.ip_address || ''}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RemoteAssist_AuditLogs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit logs exported to CSV');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('elevation')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
          <ShieldAlert className="w-3 h-3" /> {action}
        </span>
      );
    }
    if (action.includes('session')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400">
          <Monitor className="w-3 h-3" /> {action}
        </span>
      );
    }
    if (action.includes('file')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
          <FileText className="w-3 h-3" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        <Key className="w-3 h-3" /> {action}
      </span>
    );
  };

  const filteredLogs = logs.filter(l => 
    l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.user_name && l.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (l.user_email && l.user_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (l.session_code && l.session_code.includes(searchQuery))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            Security & Session Audit Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Immutable enterprise audit trail of all remote support sessions, administrative elevations, and file transfers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setIsLoading(true); fetchLogs(); }}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search details, user, email or session code..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Action:</span>
          {[
            { id: 'all', label: 'All Events' },
            { id: 'session_created', label: 'Sessions' },
            { id: 'elevation_requested', label: 'Elevations' },
            { id: 'file_transfer_started', label: 'Files' },
            { id: 'user_login', label: 'Logins' },
            { id: 'device_connected', label: 'Unattended' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActionFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                actionFilter === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            Loading audit records...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-gray-500 dark:text-gray-400">
            No audit logs found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-750 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Timestamp</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Session / IP</th>
                  <th className="px-6 py-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-sans">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      <div className="font-mono text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {log.user_name ? (
                        <>
                          <div className="font-semibold text-gray-900 dark:text-white">{log.user_name}</div>
                          <div className="text-gray-400">{log.user_email}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                      {log.session_code && (
                        <div className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          #{log.session_code}
                        </div>
                      )}
                      <div className="text-gray-400 text-[11px]">{log.ip_address || '—'}</div>
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-700 dark:text-gray-300 max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogs;

