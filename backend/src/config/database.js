import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'parking_monitor',
});
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS nodes (id SERIAL PRIMARY KEY, node_id VARCHAR(255) UNIQUE NOT NULL, type VARCHAR(100), has_cam BOOLEAN DEFAULT false, location TEXT, last_status VARCHAR(50), last_parking_state VARCHAR(50), last_video_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    await client.query(`CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, node_id VARCHAR(255) NOT NULL, topic TEXT NOT NULL, payload TEXT, event_type VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_node_id ON events(node_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);`);
    console.log('✅ Database schema initialized');
  } finally { client.release(); }
}
export async function upsertNode(nodeData) {
  const { nodeId, type, hasCam, location, lastStatus, lastParkingState, lastVideoUrl } = nodeData;
  const query = `INSERT INTO nodes (node_id, type, has_cam, location, last_status, last_parking_state, last_video_url, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) ON CONFLICT (node_id) DO UPDATE SET type = COALESCE($2, nodes.type), has_cam = COALESCE($3, nodes.has_cam), location = COALESCE($4, nodes.location), last_status = COALESCE($5, nodes.last_status), last_parking_state = COALESCE($6, nodes.last_parking_state), last_video_url = COALESCE($7, nodes.last_video_url), updated_at = CURRENT_TIMESTAMP RETURNING *;`;
  const values = [nodeId, type || null, hasCam !== undefined ? hasCam : null, location || null, lastStatus || null, lastParkingState || null, lastVideoUrl || null];
  const result = await pool.query(query, values);
  return result.rows[0];
}
export async function insertEvent(eventData) {
  const { nodeId, topic, payload, eventType } = eventData;
  const result = await pool.query('INSERT INTO events (node_id, topic, payload, event_type) VALUES ($1, $2, $3, $4) RETURNING *;', [nodeId, topic, payload, eventType]);
  return result.rows[0];
}
export async function getAllNodes() {
  const result = await pool.query('SELECT * FROM nodes ORDER BY created_at DESC');
  return result.rows;
}
export async function getNodeEvents(nodeId, limit = 100) {
  const result = await pool.query('SELECT * FROM events WHERE node_id = $1 ORDER BY created_at DESC LIMIT $2', [nodeId, limit]);
  return result.rows;
}
export async function getAllEvents(limit = 100) {
  const result = await pool.query('SELECT * FROM events ORDER BY created_at DESC LIMIT $1', [limit]);
  return result.rows;
}

export async function initViolationLogs() {
  const client = await pool.connect();
  try {
    // Parking states: IDLE, SOMETHING_DETECTED, VEHICLE_DETECTED, VIOLATION
    await client.query(`
      CREATE TABLE IF NOT EXISTS violation_logs (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(255) NOT NULL,
        violation_type VARCHAR(100),
        details TEXT,
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        video_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violation_logs_node_id ON violation_logs(node_id);
    `);
    
    // Parking session tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS parking_sessions (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(255) NOT NULL,
        parking_state VARCHAR(100) DEFAULT 'IDLE',
        detection_time TIMESTAMP,
        vehicle_detection_time TIMESTAMP,
        violation_time TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_parking_sessions_node_id ON parking_sessions(node_id);
    `);
    
    console.log('✅ Violation logs and parking sessions tables initialized');
  } finally {
    client.release();
  }
}

export async function logViolation(nodeId, type, details) {
  const query = `
    INSERT INTO violation_logs (node_id, violation_type, details)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const result = await pool.query(query, [nodeId, type, details]);
  return result.rows[0];
}

// Parking state management
export async function createParkingSession(nodeId) {
  const query = `
    INSERT INTO parking_sessions (node_id, parking_state)
    VALUES ($1, 'IDLE')
    RETURNING *;
  `;
  const result = await pool.query(query, [nodeId]);
  return result.rows[0];
}

export async function updateParkingState(nodeId, newState, sessionId = null) {
  let query;
  let values;
  
  if (sessionId) {
    query = `
      UPDATE parking_sessions 
      SET parking_state = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    values = [newState, sessionId];
  } else {
    // Update most recent active session
    query = `
      UPDATE parking_sessions 
      SET parking_state = $1, updated_at = CURRENT_TIMESTAMP
      WHERE node_id = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
      RETURNING *;
    `;
    values = [newState, nodeId];
  }
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function updateSessionTimestamp(sessionId, fieldName) {
  // fieldName: 'detection_time', 'vehicle_detection_time', or 'violation_time'
  const query = `
    UPDATE parking_sessions 
    SET ${fieldName} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;
  const result = await pool.query(query, [sessionId]);
  return result.rows[0];
}

export async function getActiveParkingSession(nodeId) {
  const query = `
    SELECT * FROM parking_sessions 
    WHERE node_id = $1 AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const result = await pool.query(query, [nodeId]);
  return result.rows[0];
}

export async function closeParkingSession(sessionId) {
  const query = `
    UPDATE parking_sessions 
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;
  const result = await pool.query(query, [sessionId]);
  return result.rows[0];
}

export async function getViolationLogs(nodeId, limit = 50) {
  const result = await pool.query(
    'SELECT * FROM violation_logs WHERE node_id = $1 ORDER BY created_at DESC LIMIT $2',
    [nodeId, limit]
  );
  return result.rows;
}

export async function deleteNode(nodeId) {
  await pool.query('DELETE FROM events WHERE node_id = $1', [nodeId]);
  await pool.query('DELETE FROM violation_logs WHERE node_id = $1', [nodeId]);
  await pool.query('DELETE FROM nodes WHERE node_id = $1', [nodeId]);
}
