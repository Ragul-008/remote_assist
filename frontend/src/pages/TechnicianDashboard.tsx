import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  Play, Copy, Check, Users, Clock, Plus, Loader2, Link as LinkIcon, 
  HardDrive, ArrowRight, Headphones, Search, Laptop, ShieldCheck, Share2,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const TechnicianDashboard = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [onlineDevicesCount, setOnlineDevicesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [latestCreatedSession, setLatestCreatedSession] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
    fetchDevicesCount();
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

  const fetchDevicesCount = async () => {
    try {
      const res = await api.get('/devices');
      const online = res.data.filter((d: any) => d.status === 'online').length;
      setOnlineDevicesCount(online);
    } catch {
      // Ignore
    }
  };

  const createSession = async () => {
    setIsCreating(true);
    try {
      const response = await api.post('/sessions');
      setSessions([response.data, ...sessions]);
      setLatestCreatedSession(response.data);
      toast.success('Instant Support Session created!');
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
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const filteredSessions = sessions.filter(s => {
    const matchesTab = 
      filterTab === 'all' ? true :
      filterTab === 'active' ? (s.status === 'active' || s.status === 'pending') :
      s.status === 'completed';

    const matchesSearch = 
      s.session_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* Page Title & Zoho Assist Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Headphones className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Remote Support Console
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Logged in as <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.name}</span> ({user?.role?.toUpperCase()}) • Ready to handle client sessions
          </p>
        </div>

        <button
          onClick={createSession}
          disabled={isCreating}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide shadow-md shadow-blue-500/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-70"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Start Instant Support
        </button>
      </div>

      {/* Zoho Assist Hero: Live Session Generator Card */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-blue-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold border border-blue-400/30">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
              Instant Remote Support Session
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Connect to Any Remote Computer in Seconds
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Generate a secure 9-digit key or share an invite link. The customer opens the lightweight portable client, and you can instantly view and control their desktop with zero pre-installation.
            </p>
          </div>

          <div className="w-full lg:w-auto bg-slate-800/80 backdrop-blur-md p-4 rounded-xl border border-slate-700/80 shadow-inner flex flex-col sm:flex-row items-center gap-4">
            {latestCreatedSession ? (
              <div className="space-y-3 w-full">
                <div className="text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Live Session Key
                  </span>
                  <div className="text-2xl font-mono font-extrabold text-blue-400 tracking-widest mt-0.5">
                    {latestCreatedSession.session_code.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => joinSession(latestCreatedSession.session_code)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Enter Room
                  </button>
                  <button
                    onClick={() => handleCopy(latestCreatedSession.session_code)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    {copiedCode === latestCreatedSession.session_code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Key
                  </button>
                  <button
                    onClick={() => handleCopyLink(latestCreatedSession.session_code)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    {copiedLink === latestCreatedSession.session_code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    Copy Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <div className="text-xs text-slate-300 text-center sm:text-left">
                  <p className="font-semibold text-white">No session actively queued</p>
                  <p className="text-[11px] text-slate-400">Click below to generate a new customer key.</p>
                </div>
                <button
                  onClick={createSession}
                  disabled={isCreating}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer whitespace-nowrap"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Generate Key
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800/80 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Support Sessions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {activeSessions.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Headphones className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-time WebRTC ready
          </div>
        </div>

        {/* Unattended Computers Online */}
        <div 
          onClick={() => navigate('/devices')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800/80 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Unattended Computers</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                {onlineDevicesCount}
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  online
                </span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
            <span>Manage Workstations</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Completed Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Resolved Sessions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {completedSessions.length}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 font-medium">
            Archived in audit logs
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Clients Supported</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {new Set(sessions.map(s => s.customer_id).filter(Boolean)).size}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 font-medium">
            Unique customer accounts
          </div>
        </div>
      </div>

      {/* Sessions Management Table (Zoho Assist Style) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800/80 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Support Sessions
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
              {sessions.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Filter Tabs */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterTab === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterTab('active')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterTab === 'active' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Active ({activeSessions.length})
              </button>
              <button
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterTab === 'completed' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Completed ({completedSessions.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search session or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-xs font-medium">Loading session directory...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Laptop className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No support sessions found</p>
              <p className="text-xs text-slate-500 mt-1">Click "Start Instant Support" to create your first session.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Session Key</th>
                  <th className="px-6 py-3.5">Type & Target</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Resolution Notes</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Session Key */}
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{session.session_code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span>
                        <button
                          onClick={() => handleCopy(session.session_code)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                          title="Copy Key"
                        >
                          {copiedCode === session.session_code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopyLink(session.session_code)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                          title="Copy Direct Link"
                        >
                          {copiedLink === session.session_code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    {/* Target & Mode */}
                    <td className="px-6 py-4">
                      {session.is_unattended ? (
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {session.device_name || 'Unattended Host'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {session.customer_name || 'Remote Customer'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status Chip */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full ${
                        session.status === 'active' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                        session.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                        'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          session.status === 'active' ? 'bg-blue-500 animate-pulse' :
                          session.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                        {session.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">
                      {session.duration_seconds ? (
                        `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s`
                      ) : (
                        session.status === 'active' ? (
                          <span className="text-blue-500 font-medium animate-pulse">In Progress</span>
                        ) : '---'
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-6 py-4 max-w-xs truncate text-slate-600 dark:text-slate-400 italic">
                      {session.notes || <span className="text-slate-300 dark:text-slate-600 not-italic">None</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {(session.status === 'pending' || session.status === 'active') ? (
                        <button
                          onClick={() => joinSession(session.session_code)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Connect
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-mono">Archived</span>
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
