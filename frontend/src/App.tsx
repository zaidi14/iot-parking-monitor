import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, Node, ViolationLog } from './services/api';

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [violations, setViolations] = useState<ViolationLog[]>([]);
  const [showVideo, setShowVideo] = useState<{[key: string]: boolean}>({});
  const [socket, setSocket] = useState<Socket | null>(null);
  
  useEffect(() => {
    api.getNodes().then(setNodes);
    
    const socketInstance = io('http://localhost:3001');
    setSocket(socketInstance);
    
    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));
    
    socketInstance.on('mqtt_event', (data: any) => {
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
    
    return () => { socketInstance.disconnect(); };
  }, []);
  
  const loadViolations = async (nodeId: string) => {
    const logs = await api.getViolationLogs(nodeId);
    setViolations(logs);
    setSelectedNode(nodeId);
  };
  
  const handleDeleteNode = async (nodeId: string) => {
    if (confirm(`Remove node ${nodeId}? This will delete all its data.`)) {
      try {
        await api.deleteNode(nodeId);
        // Immediately remove from UI
        setNodes(prev => prev.filter(n => n.node_id !== nodeId));
        // Close violation modal if it's open for this node
        if (selectedNode === nodeId) {
          setSelectedNode(null);
        }
        // Remove video state
        setShowVideo(prev => {
          const copy = {...prev};
          delete copy[nodeId];
          return copy;
        });
        console.log(`✅ Node ${nodeId} removed`);
      } catch (error) {
        console.error('Failed to delete node:', error);
        alert('Failed to delete node. Please try again.');
      }
    }
  };
  
  const handleStartVideo = async (nodeId: string) => {
    await api.startVideo(nodeId);
    setShowVideo(prev => ({...prev, [nodeId]: true}));
  };
  
  const handleStopVideo = async (nodeId: string) => {
    await api.stopVideo(nodeId);
    setShowVideo(prev => ({...prev, [nodeId]: false}));
  };
  
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ color: '#6b7280', fontSize: '14px' }}>Active Nodes: <strong>{nodes.length}</strong></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }} />
              <span style={{ color: '#6b7280' }}>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>
      
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        {nodes.length === 0 ? (
          <div style={{ background: 'white', padding: '60px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
              No parking nodes detected yet.
            </p>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              Waiting for ESP32 devices to connect...
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
            {nodes.map(node => (
              <div key={node.node_id} style={{ 
                background: 'white', 
                padding: '24px', 
                borderRadius: '8px', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: node.last_parking_state === 'violation' ? '3px solid #ef4444' : '1px solid #e5e7eb',
                position: 'relative'
              }}>
                <button
                  onClick={() => handleDeleteNode(node.node_id)}
                  title="Remove this node"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  ✕
                </button>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', marginRight: '50px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>Node {node.node_id}</h3>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getStatusColor(node.last_status) }} />
                </div>
                
                {node.location && (
                  <p style={{ color: '#6b7280', marginBottom: '8px', fontSize: '14px' }}>📍 {node.location}</p>
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
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {node.last_parking_state === 'violation' && (
                    <button 
                      onClick={() => api.silenceNode(node.node_id)}
                      style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                    >
                      🔇 Silence
                    </button>
                  )}
                  <button 
                    onClick={() => api.resetNode(node.node_id)}
                    style={{ padding: '10px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                  >
                    🔄 Reset
                  </button>
                  {node.has_cam && (
                    <>
                      {!showVideo[node.node_id] ? (
                        <button 
                          onClick={() => handleStartVideo(node.node_id)}
                          style={{ padding: '10px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                        >
                          ▶️ Video
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStopVideo(node.node_id)}
                          style={{ padding: '10px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                        >
                          ⏸️ Stop
                        </button>
                      )}
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => loadViolations(node.node_id)}
                  style={{ width: '100%', padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                >
                  📋 View Violations
                </button>
                
                {showVideo[node.node_id] && node.last_video_url && (
                  <div style={{ marginTop: '16px' }}>
                    <img src={node.last_video_url} alt="Live stream" style={{ width: '100%', borderRadius: '6px', border: '2px solid #3b82f6' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {selectedNode && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedNode(null)}
          >
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Violation Logs - {selectedNode}</h2>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
              
              {violations.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>No violations logged yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {violations.map(log => (
                    <div key={log.id} style={{
                      background: '#f9fafb',
                      padding: '16px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #ef4444'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{log.violation_type}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', color: '#374151' }}>{log.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
