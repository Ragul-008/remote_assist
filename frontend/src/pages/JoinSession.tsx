import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MonitorDown } from 'lucide-react';
import { motion } from 'framer-motion';

const JoinSession = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsJoining(true);

    // Hit the backend API to dynamically download the custom named .exe
    const downloadUrl = `https://remote-assist-y8ot.onrender.com/api/sessions/${sessionId}/download`;
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `RemoteAssist_Session_${sessionId}.exe`; // Fallback hint
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Wait a little bit then reset and show instruction
    setTimeout(() => {
      setIsJoining(false);
      alert("Downloading your custom support app!\n\nWhen it finishes downloading, simply open the file and it will connect instantly.");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <MonitorDown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            RemoteAssist
          </h2>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
          Join Remote Support Session
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100 dark:border-gray-700"
        >
          <form className="space-y-6" onSubmit={handleJoin}>
            <div>
              <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Session ID
              </label>
              <div className="mt-1">
                <input
                  id="sessionId"
                  name="sessionId"
                  type="text"
                  value={sessionId || ''}
                  readOnly
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 sm:text-lg tracking-widest font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-md dark:bg-gray-700 dark:text-white transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isJoining || !name.trim()}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors uppercase tracking-wider"
              >
                {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Join Session
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Join session right from your desktop
            </p>
            <a 
              href="https://github.com/Ragul-008/remote_assist/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Download quick support
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default JoinSession;
