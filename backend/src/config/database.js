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
    await client.query(`
      CREATE TABLE IF NOT EXISTS violation_logs (
        id SERIAL PRIMARY KEY,
        node_id VARCHAR(255) NOT NULL,
        violation_type VARCHAR(100),
        details TEXT,
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_violation_logs_node_id ON violation_logs(node_id);
    `);
    console.log('✅ Violation logs table initialized');
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
