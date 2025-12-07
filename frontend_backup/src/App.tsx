import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api, Node } from './services/api';

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    api.getNodes().then(setNodes);
    
    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    
    socket.on('mqtt_event', (data: any) => {
      if (data.node) {
        setNodes(prev => {
          const idx = prev.findIndex(n => n.node_id === data.node.node_id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.node;
            return copy;
          }
          return [...prev, data.node];
        });
      }
    });
    
    return () => { socket.disconnect(); };
  }, []);
  
  const getStatusColor = (status: string | null) => {
    return status === 'online' ? '#10b981' : '#6b7280';
  };
  
  const getParkingColor = (state: string | null) => {
    switch (state) {
      case 'violation': return '#ef4444';
      case 'timer_running': return '#f59e0b';
      case 'vehicle_detected': return '#3b82f6';
      default: return '#6b7280';
    }
  };
  
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{ background: 'white', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>🚗 IoT Parking Monitor</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }} />
            <span style={{ color: '#6b7280' }}>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>
      
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        {nodes.length === 0 ? (
          <div style={{ background: 'white', padding: '60px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', color: '#6b7280' }}>
              No parking nodes detected yet. Waiting for ESP32 devices...
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {nodes.map(node => (
              <div key={node.node_id} style={{ 
                background: 'white', 
                padding: '24px', 
                borderRadius: '8px', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: node.last_parking_state === 'violation' ? '3px solid #ef4444' : '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>Node {node.node_id}</h3>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getStatusColor(node.last_status) }} />
                </div>
                
                {node.location && (
                  <p style={{ color: '#6b7280', marginBottom: '8px' }}>📍 {node.location}</p>
                )}
                
                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                  <p style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>Status: </span>
                    <span style={{ fontWeight: '500' }}>{node.last_status || 'Unknown'}</span>
                  </p>
                  <p style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280', fontSize: '14px' }}>Parking: </span>
                    <span style={{ fontWeight: '500', color: getParkingColor(node.last_parking_state) }}>
                      {node.last_parking_state || 'idle'}
                    </span>
                  </p>
                  <p>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>Updated: </span>
                    <span style={{ fontSize: '12px' }}>{new Date(node.updated_at).toLocaleString()}</span>
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {node.last_parking_state === 'violation' && (
                    <button 
                      onClick={() => api.silenceNode(node.node_id)}
                      style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      🔇 Silence
                    </button>
                  )}
                  <button 
                    onClick={() => api.resetNode(node.node_id)}
                    style={{ padding: '10px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                  >
                    🔄 Reset
                  </button>
                  {node.has_cam && (
                    <button 
                      onClick={() => api.startVideo(node.node_id)}
                      style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      ▶️ Video
                    </button>
                  )}
                </div>
                
                {node.last_video_url && (
                  <div style={{ marginTop: '16px' }}>
                    <img src={node.last_video_url} alt="Live stream" style={{ width: '100%', borderRadius: '6px' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
