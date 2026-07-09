import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, Monitor, Play, Check, Copy, Loader2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SessionsList = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions');
      setSessions(response.data);
    } catch (error) {
      toast.error('Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Code copied to clipboard');
  };

  const joinSession = (code: string) => {
    navigate(`/room/${code}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {user?.role === 'technician' ? 'All Sessions' : 'My Sessions'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View your remote assistance history
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
              Loading history...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
              <Calendar className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No sessions found</p>
              <p className="text-sm">You haven't participated in any support sessions yet.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-4 font-semibold">Code</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  {user?.role === 'technician' && <th className="px-6 py-4 font-semibold">Customer ID</th>}
                  {user?.role === 'customer' && <th className="px-6 py-4 font-semibold">Technician ID</th>}
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.map((session) => (
                  <tr key={session.id} className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono font-medium text-gray-900 dark:text-white">
                        {session.session_code}
                        <button 
                          onClick={() => handleCopy(session.session_code)}
                          className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {copiedCode === session.session_code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                        session.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        session.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {session.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>}
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {new Date(session.start_time).toLocaleDateString()} {new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    {user?.role === 'technician' && (
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {session.customer_id ? session.customer_id.substring(0,8) + '...' : '—'}
                      </td>
                    )}
                    {user?.role === 'customer' && (
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {session.technician_id ? session.technician_id.substring(0,8) + '...' : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      {(session.status === 'pending' || session.status === 'active') && (
                        <button
                          onClick={() => joinSession(session.session_code)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-md transition-colors"
                        >
                          <Play className="w-4 h-4" /> Rejoin
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionsList;
