import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Play, Headset, Loader2, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const CustomerDashboard = () => {
  const { user } = useAuth();
  const [sessionCode, setSessionCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const handleJoinSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim() || sessionCode.length !== 9) {
      toast.error('Please enter a valid 9-digit session code');
      return;
    }

    setIsJoining(true);
    try {
      await api.post(`/sessions/join/${sessionCode}`);
      toast.success('Joined session successfully');
      navigate(`/room/${sessionCode}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to join session. Please check the code.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Support Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Welcome, {user?.name}. Need assistance?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700"
        >
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center mb-6">
            <Headset className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Join a Support Session</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            Enter the 9-digit session code provided by your support technician to start sharing your screen and get remote assistance.
          </p>

          <form onSubmit={handleJoinSession} className="space-y-4">
            <div>
              <label htmlFor="sessionCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Session Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="sessionCode"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-lg tracking-widest font-mono dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="123456789"
                  maxLength={9}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isJoining || sessionCode.length !== 9}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-colors shadow-sm"
            >
              {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              Join Session
            </button>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-indigo-50 dark:bg-gray-800/50 p-8 rounded-2xl border border-indigo-100 dark:border-gray-700 flex flex-col justify-center"
        >
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 mb-4">How it works</h3>
          <ol className="space-y-4 text-sm text-indigo-800 dark:text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-400">1</span>
              <p>Contact your support team and request a remote session.</p>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-400">2</span>
              <p>The technician will provide you with a unique 9-digit session code.</p>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-400">3</span>
              <p>Enter the code here and click "Join Session".</p>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-400">4</span>
              <p>Allow screen sharing permissions when prompted by your browser to start the remote support.</p>
            </li>
          </ol>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
