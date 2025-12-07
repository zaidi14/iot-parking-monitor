import express from 'express';
import {
  getAllNodes,
  getNodeEvents,
  getAllEvents,
  getViolationLogs,
  deleteNode
} from '../config/database.js';
import { publishMqtt } from '../services/mqttService.js';

const router = express.Router();

// Get all nodes
router.get('/nodes', async (req, res) => {
  try {
    res.json(await getAllNodes());
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get events for a node
router.get('/nodes/:nodeId/events', async (req, res) => {
  try {
    res.json(await getNodeEvents(req.params.nodeId, parseInt(req.query.limit) || 100));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get all events
router.get('/events', async (req, res) => {
  try {
    res.json(await getAllEvents(parseInt(req.query.limit) || 100));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get violation logs for a node
router.get('/nodes/:nodeId/violations', async (req, res) => {
  try {
    res.json(await getViolationLogs(req.params.nodeId, parseInt(req.query.limit) || 50));
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Delete/remove a node
router.delete('/nodes/:nodeId', async (req, res) => {
  try {
    await deleteNode(req.params.nodeId);
    // Publish offline status
    await publishMqtt(`node/${req.params.nodeId}/status`, 'offline');
    res.json({ success: true, message: 'Node removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Silence node buzzer
router.post('/nodes/:nodeId/silence', async (req, res) => {
  try {
    await publishMqtt(`node/${req.params.nodeId}/cmd/silence`, '1');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Reset node
router.post('/nodes/:nodeId/reset', async (req, res) => {
  try {
    await publishMqtt(`node/${req.params.nodeId}/cmd/reset`, '1');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Start video streaming
router.post('/nodes/:nodeId/video/start', async (req, res) => {
  try {
    await publishMqtt(`node_cam/${req.params.nodeId}/cmd/start_video`, '1');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Stop video streaming
router.post('/nodes/:nodeId/video/stop', async (req, res) => {
  try {
    await publishMqtt(`node_cam/${req.params.nodeId}/cmd/stop_video`, '1');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
