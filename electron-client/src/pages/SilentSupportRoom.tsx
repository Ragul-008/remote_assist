import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, PhoneOff } from 'lucide-react';

const SilentSupportRoom = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Setup WebSocket with proper secure wss/ws protocol
    let wsUrl = 'ws://localhost:8000';
    if (import.meta.env.VITE_API_URL) {
      try {
        const url = new URL(import.meta.env.VITE_API_URL);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${url.host}`;
      } catch {
        wsUrl = import.meta.env.VITE_API_URL.replace(/^http/, 'ws').replace(/\/api$/, '');
      }
    }
      
    const socket = new WebSocket(`${wsUrl}/ws/${sessionCode}?role=customer`);
    wsRef.current = socket;
    
    socket.onopen = () => {
      // Start sharing screen immediately upon connection
      startScreenShare();
      if ((window as any).ipcRenderer) {
        (window as any).ipcRenderer.send('session-active', true);
        (window as any).ipcRenderer.send('set-floating-widget');
      }
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'control') {
        if ((window as any).ipcRenderer) {
          (window as any).ipcRenderer.send('remote-control', data.payload);
        }
      } else if (data.type === 'system' && data.message?.toLowerCase().includes('ended')) {
        // Technician ended the session -> close the app cleanly
        if ((window as any).ipcRenderer) {
          (window as any).ipcRenderer.send('quit-app');
        }
      } else if (['offer', 'answer', 'ice-candidate'].includes(data.type)) {
        handleSignalingData(data);
      }
    };

    return () => {
      stopScreenShare();
      if ((window as any).ipcRenderer) {
        (window as any).ipcRenderer.send('session-active', false);
      }
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', payload: event.candidate }));
      }
    };
    peerConnectionRef.current = pc;
    return pc;
  };

  const handleSignalingData = async (data: any) => {
    if (!peerConnectionRef.current) createPeerConnection();
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
      if (!peerConnectionRef.current) createPeerConnection();
      
      const pc = peerConnectionRef.current!;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: 'offer', payload: offer }));
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const handleDisconnect = () => {
    stopScreenShare();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'system', 
        message: 'Customer manually ended the remote session' 
      }));
      wsRef.current.close();
    }
    if ((window as any).ipcRenderer) {
      (window as any).ipcRenderer.send('session-active', false);
      (window as any).ipcRenderer.send('quit-app');
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-between px-4 py-2 bg-gray-900/95 text-white backdrop-blur-md border border-gray-700/80 rounded-xl shadow-2xl select-none"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-gray-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Remote Support Active</span>
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            Session: #{sessionCode}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDisconnect}
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/90 hover:bg-red-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-md transition-all cursor-pointer"
        title="Stop screen sharing and disconnect technician"
      >
        <PhoneOff className="w-3.5 h-3.5" />
        <span>End Session</span>
      </button>
    </div>
  );
};

export default SilentSupportRoom;
