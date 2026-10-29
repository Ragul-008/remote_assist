import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Play, Copy, Check, Users, Clock, Monitor, Plus, Loader2, Link } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/sessions');
      setSessions(response.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error(err.response?.data?.detail || 'Failed to fetch sessions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = async () => {
    setIsCreating(true);
    try {
      const response = await api.post('/sessions');
      setSessions([response.data, ...sessions]);
      toast.success('Session created successfully');
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error('Login expired. Please log out and log in again.');
      } else {
        toast.error(err.response?.data?.detail || 'Server is waking up. Please try again in a few seconds.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Session code copied to clipboard');
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2000);
    toast.success('Join link copied to clipboard');
  };

  const joinSession = (code: string) => {
    navigate(`/room/${code}`);
  };

  const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Technician Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, {user?.name}</p>
        </div>
        <button
          onClick={createSession}
          disabled={isCreating}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-70 shadow-sm hover:shadow-md"
        >
          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          New Session
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeSessions.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg text-green-600 dark:text-green-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sessions.filter(s => s.status === 'completed').length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {new Set(sessions.map(s => s.customer_id).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Sessions</h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No sessions found. Create a new session to get started.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-3">Session Code</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created At</th>
                  <th className="px-6 py-3">Customer ID</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {session.session_code}
                        <button 
                          onClick={() => handleCopy(session.session_code)}
                          className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode === session.session_code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleCopyLink(session.session_code)}
                          className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ml-2"
                          title="Copy Join Link"
                        >
                          {copiedLink === session.session_code ? <Check className="w-4 h-4 text-green-500" /> : <Link className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        session.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        session.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(session.start_time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {session.customer_id ? (
                        <span className="text-gray-900 dark:text-white">{session.customer_id.substring(0,8)}...</span>
                      ) : (
                        <span className="text-gray-400 italic">Waiting...</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      {(session.status === 'pending' || session.status === 'active') && (
                        <button
                          onClick={() => joinSession(session.session_code)}
                          className="flex items-center gap-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors"
                        >
                          <Play className="w-4 h-4" /> Join
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

export default TechnicianDashboard;
