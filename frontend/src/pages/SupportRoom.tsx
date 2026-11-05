import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type WheelEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import api from '../services/api';
import { 
  Monitor, Video, VideoOff, MessageSquare, Send, PhoneOff, 
  Loader2, ShieldAlert, KeyRound, ShieldCheck, X, Maximize, 
  Minimize2, FileUp, Folder, ArrowRight, CheckCircle2, Clock, 
  MousePointer, Eye, EyeOff, LayoutGrid, Terminal, Download, FileText, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

interface TransferredFile {
  id: string;
  name: string;
  size: number;
  direction: 'sent' | 'received';
  timestamp: string;
  status: 'completed' | 'failed' | 'sending';
}

const SupportRoom = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Connection & Stream State
  const [_ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteAdmin, setIsRemoteAdmin] = useState(false);
  const [isCustomerControlPaused, setIsCustomerControlPaused] = useState(false);

  // Multi-Monitor & View Controls
  const [availableScreens, setAvailableScreens] = useState<{ id: string; name: string }[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string>('');
  const [screenFitMode, setScreenFitMode] = useState<'fit' | 'original' | 'stretch'>('fit');
  const [isControlEnabled, setIsControlEnabled] = useState(true); // View Only vs Full Control
  const [isPrivacyCurtainOn, setIsPrivacyCurtainOn] = useState(false); // Screen Blanking

  // Live Timer
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Live Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'files' | 'notes'>('chat');

  // File Transfer State
  const [transferredFiles, setTransferredFiles] = useState<TransferredFile[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transferProgress, setTransferProgress] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Elevation Modal
  const [showElevateModal, setShowElevateModal] = useState(false);
  const [elevateMode, setElevateMode] = useState<'credentials' | 'prompt'>('prompt');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isElevating, setIsElevating] = useState(false);

  // Session Notes & End Modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isEnding, setIsEnding] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const lastMouseMoveTime = useRef<number>(0);
  const isMouseDownRef = useRef<boolean>(false);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  // Live duration timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Format session timer HH:MM:SS
  const formatDuration = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Setup WebSocket with authentication
    const apiBase = import.meta.env.VITE_API_URL || 'https://remote-assist-y8ot.onrender.com/api';
    let wsUrl = 'wss://remote-assist-y8ot.onrender.com';
    try {
      const parsedUrl = new URL(apiBase);
      const protocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${parsedUrl.host}`;
    } catch {
      wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '');
    }
      
    const token = localStorage.getItem('token');
    const authQuery = token ? `&token=${encodeURIComponent(token)}` : '';
    const socket = new WebSocket(`${wsUrl}/ws/${sessionCode}?role=${user?.role}${authQuery}`);
    wsRef.current = socket;
    
    socket.onopen = () => {
      if (wsRef.current !== socket) return;
      setIsConnected(true);
      toast.success('Secure remote session connected');
    };

    socket.onmessage = async (event) => {
      if (wsRef.current !== socket) return;
      const data = JSON.parse(event.data);
      
      if (data.type === 'chat') {
        setMessages(prev => [...prev, { 
          sender: data.sender_role, 
          text: data.payload, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }]);
        scrollToBottom();
      } else if (data.type === 'system') {
        toast(data.message, { icon: 'ℹ️' });
      } else if (data.type === 'admin-status') {
        const adminActive = Boolean(data.payload?.isAdmin);
        setIsRemoteAdmin(adminActive);
        setIsElevating(false);
        if (adminActive) {
          toast.success('Administrator Mode Activated! Full UAC & elevated app control enabled.', { icon: '🛡️', duration: 4500 });
        }
      } else if (data.type === 'control-status-changed') {
        const isPaused = Boolean(data.payload?.isControlPaused);
        setIsCustomerControlPaused(isPaused);
        if (isPaused) {
          toast('Customer paused remote control', { icon: '⏸️' });
        } else {
          toast.success('Customer resumed remote control');
        }
      } else if (data.type === 'available-screens') {
        if (Array.isArray(data.payload?.screens)) {
          setAvailableScreens(data.payload.screens);
          if (data.payload.screens.length > 0 && !selectedScreenId) {
            setSelectedScreenId(data.payload.screens[0].id);
          }
        }
      } else if (data.type === 'file-transfer-saved') {
        toast.success(`File "${data.payload?.filename}" successfully saved on remote machine!`, { icon: '📁', duration: 4000 });
        setTransferredFiles(prev => prev.map(f => f.name === data.payload?.filename ? { ...f, status: 'completed' } : f));
      } else if (data.type === 'elevation-progress') {
        toast(data.message || 'Processing elevation...', { icon: '⏳' });
      } else if (data.type === 'elevation-failed') {
        setIsElevating(false);
        toast.error(data.message || 'Elevation failed', { duration: 5000 });
      } else {
        handleSignalingData(data);
      }
    };

    socket.onclose = (event) => {
      if (wsRef.current !== socket) return;
      setIsConnected(false);
      if (event.code === 4001 || event.code === 4003) {
        toast.error(`Access Denied: ${event.reason || 'Unauthorized'}`);
      } else if (event.code === 4004) {
        toast.error('Session not found');
      } else {
        toast.error('Disconnected from remote session');
      }
    };

    setWs(socket);

    return () => {
      stopScreenShare();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          payload: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setHasRemoteStream(true);
      }
    };
    
    peerConnectionRef.current = pc;
    return pc;
  };

  const handleSignalingData = async (data: any) => {
    if (data.type === 'offer') {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
      }
      createPeerConnection();
    } else if (!peerConnectionRef.current) {
      createPeerConnection();
    }
    const pc = peerConnectionRef.current!;

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: 'answer', payload: answer }));
        
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else if (data.type === 'ice-candidate') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.payload));
        } else {
          iceCandidatesQueue.current.push(data.payload);
        }
      }
    } catch (err) {
      console.error("Error handling signaling data:", err);
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" } as any,
        audio: false 
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (!peerConnectionRef.current) createPeerConnection();
      const pc = peerConnectionRef.current!;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: 'offer', payload: offer }));
      setIsScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) {
      console.error("Error starting screen share:", err);
      toast.error('Failed to start screen sharing');
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
  };

  // Accurate Relative Coordinate Calculation
  const getCoordinates = (e: MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();
    const videoWidth = video.videoWidth || 1920;
    const videoHeight = video.videoHeight || 1080;
    const videoRatio = videoWidth / videoHeight;
    const containerRatio = rect.width / rect.height;

    let actualWidth = rect.width;
    let actualHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (screenFitMode === 'fit') {
      if (containerRatio > videoRatio) {
        actualWidth = rect.height * videoRatio;
        offsetX = (rect.width - actualWidth) / 2;
      } else {
        actualHeight = rect.width / videoRatio;
        offsetY = (rect.height - actualHeight) / 2;
      }
    }

    const relativeX = (e.clientX - rect.left - offsetX) / actualWidth;
    const relativeY = (e.clientY - rect.top - offsetY) / actualHeight;

    return {
      x: Math.max(0, Math.min(1, relativeX)),
      y: Math.max(0, Math.min(1, relativeY)),
      valid: relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1
    };
  };

  // Mouse Interaction Handlers
  const handleVideoInteraction = (e: MouseEvent<HTMLVideoElement>, action: string) => {
    if (user?.role !== 'technician' || !wsRef.current || !hasRemoteStream || !isControlEnabled) return;
    if (isCustomerControlPaused) {
      toast('Remote control is temporarily paused by customer', { id: 'cust-paused' });
      return;
    }

    const { x, y, valid } = getCoordinates(e);
    if (!valid && action !== 'mouseup') return;

    wsRef.current.send(JSON.stringify({ 
      type: 'control', 
      payload: { action, relativeX: x, relativeY: y } 
    }));
  };

  const handleMouseMove = (e: MouseEvent<HTMLVideoElement>) => {
    if (!isMouseDownRef.current || user?.role !== 'technician' || !isControlEnabled) return;
    const now = Date.now();
    if (now - lastMouseMoveTime.current < 40) return; // 25 FPS throttling for drag
    lastMouseMoveTime.current = now;

    const { x, y, valid } = getCoordinates(e);
    if (!valid) return;

    wsRef.current?.send(JSON.stringify({
      type: 'control',
      payload: { action: 'mousemove', relativeX: x, relativeY: y }
    }));
  };

  const handleWheel = (e: WheelEvent<HTMLVideoElement>) => {
    if (user?.role !== 'technician' || !wsRef.current || !hasRemoteStream || !isControlEnabled) return;
    wsRef.current.send(JSON.stringify({
      type: 'control',
      payload: { action: 'scroll', deltaY: e.deltaY }
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (user?.role !== 'technician' || !wsRef.current || !hasRemoteStream || !isControlEnabled) return;
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    e.preventDefault();
    wsRef.current.send(JSON.stringify({
      type: 'control',
      payload: { action: 'keydown', key: e.key }
    }));
  };

  // Special Keys (Zoho Assist Toolbar)
  const sendSpecialKey = (keyAction: 'cad' | 'win' | 'alttab') => {
    if (!wsRef.current || !isControlEnabled) return;
    if (keyAction === 'cad') {
      wsRef.current.send(JSON.stringify({ type: 'control', payload: { action: 'cad' } }));
      toast.success('Sent Ctrl+Alt+Del command');
    } else if (keyAction === 'win') {
      wsRef.current.send(JSON.stringify({ type: 'control', payload: { action: 'keydown', key: 'Meta' } }));
      toast.success('Sent Windows Key command');
    }
  };

  // Multi-Monitor Switch
  const handleSelectScreen = (screenId: string) => {
    setSelectedScreenId(screenId);
    wsRef.current?.send(JSON.stringify({
      type: 'select-display',
      payload: { sourceId: screenId }
    }));
    toast.success('Switched remote display source');
  };

  // Screen Blanking / Privacy Curtain (Zoho Assist Feature)
  const togglePrivacyCurtain = () => {
    const nextState = !isPrivacyCurtainOn;
    setIsPrivacyCurtainOn(nextState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'privacy-curtain',
        payload: { enabled: nextState }
      }));
      toast(nextState ? 'Remote privacy screen turned ON' : 'Remote privacy screen turned OFF', {
        icon: nextState ? '🔒' : '🔓',
      });
    }
  };

  // File Transfer
  const handleSendFile = async () => {
    if (!selectedFile || !wsRef.current) return;
    setIsTransferring(true);
    setTransferProgress(10);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        setTransferProgress(60);

        wsRef.current?.send(JSON.stringify({
          type: 'file-transfer',
          payload: {
            name: selectedFile.name,
            size: selectedFile.size,
            buffer: base64Data
          }
        }));

        setTransferredFiles(prev => [
          {
            id: String(Date.now()),
            name: selectedFile.name,
            size: selectedFile.size,
            direction: 'sent',
            timestamp: new Date().toLocaleTimeString(),
            status: 'sending'
          },
          ...prev
        ]);

        setTransferProgress(100);
        setTimeout(() => {
          setIsTransferring(false);
          setTransferProgress(null);
          setSelectedFile(null);
          setShowFileModal(false);
          toast.success(`Sent "${selectedFile.name}" to remote desktop`);
        }, 600);
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setIsTransferring(false);
      setTransferProgress(null);
      toast.error('Failed to read file');
    }
  };

  // Live Chat
  const sendChatMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({ type: 'chat', payload: newMessage }));
    setMessages(prev => [...prev, { 
      sender: user?.role || 'me', 
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setNewMessage('');
    scrollToBottom();
  };

  // Session Elevation
  const handleElevate = (e: FormEvent) => {
    e.preventDefault();
    if (elevateMode === 'credentials' && (!adminUsername.trim() || !adminPassword.trim())) {
      toast.error('Please enter administrator credentials');
      return;
    }
    setIsElevating(true);
    wsRef.current?.send(JSON.stringify({
      type: 'elevate-session',
      payload: {
        mode: elevateMode,
        username: adminUsername.trim(),
        password: adminPassword,
        sessionCode: sessionCode,
      }
    }));
    toast.success('Elevation command dispatched');
    setShowElevateModal(false);
    setIsElevating(false);
  };

  // End Session
  const confirmEndSession = async () => {
    setIsEnding(true);
    try {
      if (user?.role === 'technician') {
        await api.put(`/sessions/code/${sessionCode}/end`);
        if (sessionNotes.trim()) {
          await api.put(`/sessions/code/${sessionCode}/notes`, { notes: sessionNotes });
        }
        wsRef.current?.send(JSON.stringify({ type: 'system', message: 'Technician has ended the session.' }));
      }
      toast.success('Session ended successfully');
      navigate(user?.role === 'technician' ? '/technician' : '/customer');
    } catch {
      navigate(user?.role === 'technician' ? '/technician' : '/customer');
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Zoho Assist Style Top Header & Toolbar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-md z-30">
        {/* Left: Branding & Session Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm tracking-tight hidden sm:inline text-white">RemoteAssist</span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Key:</span>
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-indigo-300 font-bold">
              {sessionCode}
            </span>
            <div className="flex items-center gap-1.5 ml-1 text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatDuration(sessionSeconds)}</span>
            </div>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </span>
            )}
          </div>
        </div>

        {/* Center: Zoho Assist Remote Controls Toolbar (For Technician) */}
        {user?.role === 'technician' && (
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
            {/* Display Selector */}
            {availableScreens.length > 1 && (
              <select
                value={selectedScreenId}
                onChange={(e) => handleSelectScreen(e.target.value)}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
              >
                {availableScreens.map(scr => (
                  <option key={scr.id} value={scr.id}>{scr.name}</option>
                ))}
              </select>
            )}

            {/* Screen Scale Mode */}
            <button
              onClick={() => setScreenFitMode(prev => prev === 'fit' ? 'original' : 'fit')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                screenFitMode === 'fit' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
              title="Toggle Fit to Screen / Original 100%"
            >
              {screenFitMode === 'fit' ? 'Fit Window' : '100% Scale'}
            </button>

            {/* View Only vs Full Control */}
            <button
              onClick={() => setIsControlEnabled(!isControlEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors ${
                isControlEnabled ? 'bg-slate-700 text-emerald-400' : 'bg-amber-600/80 text-white'
              }`}
              title={isControlEnabled ? "Control is Enabled" : "View Only Mode"}
            >
              {isControlEnabled ? <MousePointer className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isControlEnabled ? 'Control On' : 'View Only'}</span>
            </button>

            {/* Special Keys */}
            <button
              onClick={() => sendSpecialKey('cad')}
              className="px-2.5 py-1 rounded text-slate-300 hover:bg-slate-700 font-mono text-[11px] hover:text-white"
              title="Send Ctrl+Alt+Del (Opens Security & Task Manager)"
            >
              Ctrl+Alt+Del
            </button>

            {/* File Transfer Quick Button */}
            <button
              onClick={() => setShowFileModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-slate-300 hover:bg-slate-700 hover:text-white"
              title="Send files to remote computer"
            >
              <FileUp className="w-3.5 h-3.5 text-indigo-400" />
              <span>Send File</span>
            </button>

            {/* Privacy Screen / Blank Remote Display */}
            <button
              onClick={togglePrivacyCurtain}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                isPrivacyCurtainOn ? 'bg-amber-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title={isPrivacyCurtainOn ? "Privacy Screen is ACTIVE (Customer display is blanked)" : "Blank remote customer display for privacy"}
            >
              <EyeOff className="w-3.5 h-3.5 text-amber-300" />
              <span>{isPrivacyCurtainOn ? 'Screen Blanked' : 'Blank Screen'}</span>
            </button>
          </div>
        )}

        {/* Right: Actions, Elevation, End */}
        <div className="flex items-center gap-2">
          {user?.role === 'technician' && (
            isRemoteAdmin ? (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/90 text-white rounded-md text-xs font-semibold shadow-sm"
                title="Remote client is running with Full Administrator privileges. UAC prompts are visible."
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden sm:inline">Admin Mode</span>
              </div>
            ) : (
              <button
                onClick={() => setShowElevateModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-all shadow-sm"
                title="Elevate remote session to Administrator mode to control Windows UAC"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Elevate</span>
              </button>
            )
          )}

          {user?.role === 'customer' && (
            <button 
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                isScreenSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isScreenSharing ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              <span>{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
            </button>
          )}

          <button 
            onClick={() => setShowEndModal(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title="End Session"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">End Session</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Remote Desktop Canvas Viewport */}
        <main 
          className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-auto focus:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {/* Customer Control Paused Banner */}
          {isCustomerControlPaused && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-amber-600/90 backdrop-blur-md text-white text-xs font-semibold rounded-lg shadow-lg">
              <AlertCircle className="w-4 h-4" />
              <span>Customer has temporarily paused remote control. You can still view the screen.</span>
            </div>
          )}

          {/* Remote Video Element */}
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
            muted={user?.role === 'customer'}
            className={`max-w-full max-h-full ${
              screenFitMode === 'fit' ? 'object-contain w-full h-full' : 'object-none'
            } ${isControlEnabled && !isCustomerControlPaused ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={(e) => {
              isMouseDownRef.current = true;
              handleVideoInteraction(e, 'mousedown');
            }}
            onMouseUp={(e) => {
              isMouseDownRef.current = false;
              handleVideoInteraction(e, 'mouseup');
            }}
            onMouseMove={handleMouseMove}
            onClick={(e) => handleVideoInteraction(e, 'click')}
            onDoubleClick={(e) => handleVideoInteraction(e, 'doubleclick')}
            onContextMenu={(e) => { 
              e.preventDefault(); 
              handleVideoInteraction(e, 'rightclick'); 
            }}
            onWheel={handleWheel}
          />

          {/* Mini local preview PiP */}
          <div className={`absolute bottom-4 left-4 w-48 aspect-video bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl z-10 ${isScreenSharing ? 'block' : 'hidden'}`}>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>

          {/* Empty state while waiting for screen */}
          {!hasRemoteStream && !isScreenSharing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-950 z-10 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-indigo-500 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-slate-400">
                {user?.role === 'technician' ? 'Waiting for remote customer to connect and stream desktop...' : 'Click "Share Screen" or launch the portable client.'}
              </p>
              <div className="text-xs text-slate-600 font-mono">
                WebRTC Peer-to-Peer Encrypted Stream
              </div>
            </div>
          )}
        </main>

        {/* Zoho Assist Right Sidebar (Chat, Files, Notes) */}
        <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-20">
          {/* Tab Navigation */}
          <div className="h-12 border-b border-slate-800 flex items-center px-2 bg-slate-900/80">
            <button
              onClick={() => setActiveSidebarTab('chat')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                activeSidebarTab === 'chat' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setActiveSidebarTab('files')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                activeSidebarTab === 'files' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>

            {user?.role === 'technician' && (
              <button
                onClick={() => setActiveSidebarTab('notes')}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                  activeSidebarTab === 'notes' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
              </button>
            )}
          </div>

          {/* Tab: Chat */}
          {activeSidebarTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                    <span>No chat messages yet</span>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender === user?.role;
                    return (
                      <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                          <span className="font-semibold capitalize">{msg.sender}</span>
                          <span>•</span>
                          <span>{msg.time}</span>
                        </div>
                        <div className={`px-3 py-2 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm' 
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-slate-800 bg-slate-900">
                <form onSubmit={sendChatMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type message to client..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder-slate-500"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tab: Files */}
          {activeSidebarTab === 'files' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">File Transfer Log</span>
                <button
                  onClick={() => setShowFileModal(true)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <FileUp className="w-3.5 h-3.5" /> Send File
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {transferredFiles.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Folder className="w-8 h-8 mb-2 opacity-30" />
                    <span>No files transferred in this session</span>
                  </div>
                ) : (
                  transferredFiles.map(file => (
                    <div key={file.id} className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/80 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200 truncate max-w-[170px]">{file.name}</span>
                        <span className="text-[10px] text-slate-400">{file.timestamp}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Transferred
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab: Notes */}
          {activeSidebarTab === 'notes' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-3">
              <div className="text-xs font-semibold text-slate-300">Technician Remarks & Audit Notes</div>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Enter problem diagnosis, steps taken, or follow-up notes for this support ticket..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none placeholder-slate-500"
              />
              <button
                onClick={async () => {
                  try {
                    await api.put(`/sessions/code/${sessionCode}/notes`, { notes: sessionNotes });
                    toast.success('Notes saved to session log');
                  } catch {
                    toast.error('Failed to save notes');
                  }
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                Save Notes
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Send File Modal */}
      <AnimatePresence>
        {showFileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <FileUp className="w-5 h-5 text-indigo-400" />
                  <span>Transfer File to Remote Client</span>
                </div>
                <button onClick={() => setShowFileModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-300">
                  Select Local File (Logs, Patches, Installers)
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                />

                {selectedFile && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                    <div><strong>File:</strong> {selectedFile.name}</div>
                    <div><strong>Size:</strong> {(selectedFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                )}

                {transferProgress !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Sending file...</span>
                      <span>{transferProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300 rounded-full" 
                        style={{ width: `${transferProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFileModal(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || isTransferring}
                  onClick={handleSendFile}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  {isTransferring ? 'Transferring...' : 'Send to Customer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoho Assist Elevation Modal */}
      <AnimatePresence>
        {showElevateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Elevate Session</h3>
                    <p className="text-xs text-slate-400">Gain Full Windows UAC & Administrative Control</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowElevateModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleElevate} className="space-y-4">
                <div className="space-y-2">
                  <label 
                    onClick={() => setElevateMode('prompt')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      elevateMode === 'prompt' 
                        ? 'border-indigo-500 bg-indigo-950/40' 
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="elevateMode" 
                      checked={elevateMode === 'prompt'} 
                      onChange={() => setElevateMode('prompt')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">Prompt Customer for UAC Consent</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Customer will see the native Windows "Yes" confirmation prompt to grant admin rights.
                      </div>
                    </div>
                  </label>

                  <label 
                    onClick={() => setElevateMode('credentials')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      elevateMode === 'credentials' 
                        ? 'border-indigo-500 bg-indigo-950/40' 
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="elevateMode" 
                      checked={elevateMode === 'credentials'} 
                      onChange={() => setElevateMode('credentials')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">Enter Administrator Credentials</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Seamlessly elevate without end-user consent using IT admin credentials.
                      </div>
                    </div>
                  </label>
                </div>

                {elevateMode === 'credentials' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Admin Username
                      </label>
                      <input
                        type="text"
                        required
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="e.g. Administrator or .\admin"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Admin Password
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowElevateModal(false)}
                    className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isElevating}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
                  >
                    {isElevating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    <span>Confirm Elevation</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* End Session Confirmation & Wrap-Up Modal */}
      <AnimatePresence>
        {showEndModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">End Remote Support Session?</h3>
                  <p className="text-xs text-slate-400">Duration: {formatDuration(sessionSeconds)}</p>
                </div>
              </div>

              {user?.role === 'technician' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Closing Ticket Remarks / Summary (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="e.g. Cleared browser cache and reinstalled printer drivers. Issue resolved."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Continue Session
                </button>
                <button
                  type="button"
                  disabled={isEnding}
                  onClick={confirmEndSession}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  {isEnding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneOff className="w-3.5 h-3.5" />}
                  <span>Disconnect & Finish</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportRoom;
