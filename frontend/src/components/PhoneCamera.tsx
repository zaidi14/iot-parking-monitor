import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';

interface PhoneCameraProps {
  nodeId: string;
  onClose: () => void;
}

export default function PhoneCamera({ nodeId, onClose }: PhoneCameraProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please grant permission.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);

    // Stop camera after capture
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;

    setUploading(true);
    try {
      await api.uploadPhoneCamera(nodeId, capturedImage);
      alert('Photo uploaded successfully!');
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
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
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>📸 Capture Violation Photo</h2>
          <button
            onClick={onClose}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Node: <strong>{nodeId}</strong></p>
        </div>

        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                borderRadius: '8px',
                background: '#000',
                marginBottom: '16px'
              }}
            />
            <button
              onClick={capturePhoto}
              style={{
                width: '100%',
                padding: '16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              📷 Capture Photo
            </button>
          </>
        ) : (
          <>
            <img
              src={capturedImage}
              alt="Captured"
              style={{
                width: '100%',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={retake}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.5 : 1
                }}
              >
                🔄 Retake
              </button>
              <button
                onClick={uploadPhoto}
                disabled={uploading}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.5 : 1
                }}
              >
                {uploading ? '⏳ Uploading...' : '✅ Upload'}
              </button>
            </div>
          </>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
