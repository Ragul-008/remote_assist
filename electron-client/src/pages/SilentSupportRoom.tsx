import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

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
    // Setup WebSocket
    const wsUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('http', 'ws').replace('/api', '') 
      : 'ws://localhost:8000';
      
    const socket = new WebSocket(`${wsUrl}/ws/${sessionCode}?role=customer`);
    wsRef.current = socket;
    
    socket.onopen = () => {
      // Start sharing screen silently immediately upon connection
      startScreenShare();
      if ((window as any).ipcRenderer) {
        (window as any).ipcRenderer.send('session-active', true);
      }
    };

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'control') {
        if ((window as any).ipcRenderer) {
          (window as any).ipcRenderer.send('remote-control', data.payload);
        }
      } else if (data.type === 'system' && data.message?.toLowerCase().includes('ended')) {
        // Technician ended the session -> silently close the app so it doesn't run permanently
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

  // Return absolutely no UI to fulfill the headless requirement
  return null;
};

export default SilentSupportRoom;
