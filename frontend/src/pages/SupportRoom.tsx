import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import api from '../services/api';
import { 
  Monitor, Video, VideoOff, MessageSquare, Send, X, PhoneOff, 
  Settings, Loader2, MousePointer2 
} from 'lucide-react';

const SupportRoom = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Setup WebSocket
    const wsUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('http', 'ws').replace('/api', '') 
      : 'ws://localhost:8000';
      
    const socket = new WebSocket(`${wsUrl}/ws/${sessionCode}?role=${user?.role}`);
    wsRef.current = socket;
    
    socket.onopen = () => {
      if (wsRef.current !== socket) return;
      setIsConnected(true);
      toast.success('Connected to support room');
    };

    socket.onmessage = async (event) => {
      if (wsRef.current !== socket) return;
      const data = JSON.parse(event.data);
      
      if (data.type === 'chat') {
        setMessages(prev => [...prev, { sender: data.sender_role, text: data.payload }]);
        scrollToBottom();
      } else if (data.type === 'system') {
        toast(data.message, { icon: 'ℹ️' });
      } else {
        handleSignalingData(data);
      }
    };

    socket.onclose = () => {
      if (wsRef.current !== socket) return;
      setIsConnected(false);
      toast.error('Disconnected from server');
    };

    setWs(socket);

    return () => {
      stopScreenShare();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      socket.close();
    };
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

  const initiatePeerConnection = async () => {
    const pc = createPeerConnection();
    try {
      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: 'offer', payload: offer }));
    } catch (err) {
      console.error("Error creating offer:", err);
    }
  };

  const handleSignalingData = async (data: any) => {
    if (!peerConnectionRef.current) {
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
        video: { cursor: "always" },
        audio: false 
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      if (!peerConnectionRef.current) {
        createPeerConnection();
      }
      
      const pc = peerConnectionRef.current!;
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: 'offer', payload: offer }));
      
      setIsScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
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
    
    // In a real app, you'd properly renegotiate to remove tracks
    // For simplicity here, we rely on the stream ended event to clean up locally.
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({ type: 'chat', payload: newMessage }));
    setMessages(prev => [...prev, { sender: user?.role || 'me', text: newMessage }]);
    setNewMessage('');
    scrollToBottom();
  };

  const handleEndSession = async () => {
    try {
      if (user?.role === 'technician') {
        await api.put(`/sessions/code/${sessionCode}/end`);
        // Notify customer via WebSocket
        wsRef.current?.send(JSON.stringify({ type: 'system', message: 'Technician has ended the session.' }));
      }
      toast.success('Session ended');
      navigate(user?.role === 'technician' ? '/technician' : '/customer');
    } catch (error) {
      toast.error('Failed to end session properly');
      navigate(user?.role === 'technician' ? '/technician' : '/customer');
    }
  };

  const handleVideoInteraction = (e: React.MouseEvent<HTMLVideoElement>, action: string) => {
    if (user?.role !== 'technician' || !wsRef.current || !hasRemoteStream) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;

    wsRef.current.send(JSON.stringify({ 
      type: 'control', 
      payload: { action, relativeX, relativeY } 
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (user?.role !== 'technician' || !wsRef.current || !hasRemoteStream) return;
    
    // Don't send if typing in chat
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    e.preventDefault();
    wsRef.current.send(JSON.stringify({
      type: 'control',
      payload: { action: 'keydown', key: e.key }
    }));
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white overflow-hidden">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col relative">
        <header className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-indigo-400" />
            <h1 className="font-semibold text-sm">Session: <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">{sessionCode}</span></h1>
            {!isConnected && <span className="flex items-center text-xs text-yellow-500 ml-2"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Connecting...</span>}
          </div>
          
          <div className="flex items-center gap-2">
            {user?.role === 'customer' && (
              <button 
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isScreenSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isScreenSharing ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
              </button>
            )}
            <button 
              onClick={handleEndSession}
              className="bg-red-600 hover:bg-red-700 p-1.5 rounded-md text-white transition-colors ml-2"
              title="End Session"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </header>
        
        <main 
          className="flex-1 relative bg-black flex items-center justify-center p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {/* Remote Video (What Technician sees, or Customer if Technician shares) */}
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
            muted={user?.role === 'customer'}
            className="w-full h-full object-contain max-h-full cursor-crosshair"
            onClick={(e) => handleVideoInteraction(e, 'click')}
            onContextMenu={(e) => { e.preventDefault(); handleVideoInteraction(e, 'rightclick'); }}
          />
          
          {/* Local Video Overlay (Mini picture-in-picture) */}
          <div className={`absolute bottom-4 right-4 w-48 aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl ${isScreenSharing ? 'block' : 'hidden'}`}>
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
          </div>

          {(!hasRemoteStream && !isScreenSharing) && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-black z-10">
               <Monitor className="w-16 h-16 mb-4 opacity-50" />
               <p>{user?.role === 'technician' ? 'Waiting for customer to share screen...' : 'Click "Share Screen" to begin'}</p>
             </div>
          )}
        </main>
      </div>

      {/* Sidebar (Chat & Tools) */}
      <div className="w-full md:w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-1/2 md:h-full shrink-0">
        <div className="h-14 border-b border-gray-700 flex items-center px-4 shrink-0">
          <MessageSquare className="w-5 h-5 mr-2 text-gray-400" />
          <h2 className="font-semibold text-sm">Live Chat</h2>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, idx) => {
            const isMe = msg.sender === user?.role;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-gray-500 mb-1">{msg.sender.charAt(0).toUpperCase() + msg.sender.slice(1)}</span>
                <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${
                  isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-700 text-gray-200 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-gray-700 shrink-0">
          <form onSubmit={sendChatMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupportRoom;
