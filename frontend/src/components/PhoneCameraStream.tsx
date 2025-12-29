import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';

interface PhoneCameraStreamProps {
  nodeId: string;
  onClose: () => void;
}

export default function PhoneCameraStream({ nodeId, onClose }: PhoneCameraStreamProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const SERVER_IP = '192.168.1.206'; // your laptop on Wi-Fi

  useEffect(() => {
    startCamera();
    return () => {
      stopStreaming();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

 const startCamera = async () => {
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        // use 'user' if you want front camera
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    setStream(mediaStream);

    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = mediaStream;
      video.muted = true;        // required for autoplay on mobile
      video.playsInline = true;

      video.onloadedmetadata = () => {
        console.log('video metadata', video.videoWidth, video.videoHeight);
        video
          .play()
          .then(() => {
            console.log('video playing');
          })
          .catch(err => {
            console.error('video.play() failed', err);
          });
      };
    }
  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('Could not access camera. Please grant permission.');
  }
};

  
const captureAndSendFrame = async () => {
  if (!videoRef.current || !canvasRef.current) return;

  const video = videoRef.current;
  const canvas = canvasRef.current;
  const context = canvas.getContext('2d');
  if (!context) return;

  // Do not capture if video is not ready
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    // uncomment this once to see it in console:
    // console.log('video not ready, readyState=', video.readyState);
    return;
  }
  if (!video.videoWidth || !video.videoHeight) {
    // console.log('no video size yet', video.videoWidth, video.videoHeight);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);

  const frameData = canvas.toDataURL('image/jpeg', 0.6);
  // quick sanity check: should be long
  // console.log('frame length', frameData.length);

  try {
    await fetch(`http://192.168.1.206:3000/api/nodes/${nodeId}/phone/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: frameData })
    });
    frameCountRef.current++;
  } catch (error) {
    console.error('Failed to send frame:', error);
  }
};


  const startStreaming = async () => {
    setStreaming(true);
    frameCountRef.current = 0;

    // Notify backend streaming started
    await api.startPhoneStream(nodeId);

    // Start capturing frames at ~10 FPS
    intervalRef.current = window.setInterval(() => {
      captureAndSendFrame();
    }, 100); // 100ms = 10 FPS

    // FPS counter
    const fpsInterval = window.setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => clearInterval(fpsInterval);
  };

  const stopStreaming = async () => {
    setStreaming(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Notify backend streaming stopped
    try {
      await api.stopPhoneStream(nodeId);
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  const handleClose = async () => {
    await stopStreaming();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        maxWidth: '600px',
        width: '95%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>
            📹 Live Camera Stream
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Node: <strong>{nodeId}</strong></p>
          {streaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
              <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>LIVE</span>
              <span style={{ color: '#6b7280', fontSize: '12px' }}>({fps} FPS)</span>
            </div>
          )}
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            borderRadius: '8px',
            background: '#000',
            marginBottom: '16px'
          }}
        />

        {!streaming ? (
          <button
            onClick={startStreaming}
            style={{
              width: '100%',
              padding: '16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ▶️ Start Live Streaming
          </button>
        ) : (
          <button
            onClick={stopStreaming}
            style={{
              width: '100%',
              padding: '16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ⏹️ Stop Streaming
          </button>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    </div>
  );
}
