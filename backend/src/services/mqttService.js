import mqtt from 'mqtt';
import dotenv from 'dotenv';
import { upsertNode, insertEvent, logViolation, createParkingSession, updateParkingState, updateSessionTimestamp, getActiveParkingSession } from '../config/database.js';

dotenv.config();

let mqttClient = null;
let socketService = null;

export function initMqtt(io) {
  socketService = io;

  const options = {
    clientId: `parking_backend_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 1000,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  };

  mqttClient = mqtt.connect(process.env.MQTT_URL, options);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');

    const topics = [
      // NEW ARCHITECTURE
      'node/+/ctrl/#',
      'node/+/cam/#',

      // LEGACY SUPPORT (frontend-safe)
      'node/+/status',
      'node/+/parking_state',
      'node/+/alerts',
      'node_cam/+/video_url'
    ];

    topics.forEach(topic => {
      mqttClient.subscribe(topic, err => {
        if (!err) console.log(`📡 Subscribed to ${topic}`);
      });
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      await handleMqttMessage(topic, message.toString());
    } catch (err) {
      console.error('❌ MQTT handler error:', err);
    }
  });

  return mqttClient;
}

async function handleMqttMessage(topic, payload) {
  console.log(`📩 MQTT ${topic} → ${payload}`);

  const parts = topic.split('/');
  let nodeId, domain, action;

  // ---------- NEW FORMAT ----------
  if (parts[0] === 'node' && parts.length >= 4) {
    nodeId = parts[1];
    domain = parts[2];     // ctrl | cam
    action = parts[3];
  }

  // ---------- LEGACY FORMAT ----------
  else if (parts[0] === 'node' && parts.length === 3) {
    nodeId = parts[1];
    domain = 'legacy';
    action = parts[2];
  }

  // ---------- LEGACY CAM ----------
  else if (parts[0] === 'node_cam') {
    nodeId = parts[1];
    domain = 'cam';
    action = 'video_url';
  }

  const updateData = { nodeId };
  const eventType = `${domain}_${action}`;

  // ================= CTRL =================
  if (domain === 'ctrl' || domain === 'legacy') {
    switch (action) {
      case 'status':
        updateData.ctrlStatus = payload;
        break;

      case 'state':
      case 'parking_state':
        updateData.parkingState = payload;
        break;

      case 'violation':
      case 'alerts':
        await logViolation(
          nodeId,
          'parking_violation',
          'Vehicle exceeded allowed parking time'
        );
        break;
    }
  }

  // ================= CAM =================
  if (domain === 'cam') {
    switch (action) {
      case 'status':
        updateData.camStatus = payload;
        break;

      case 'video_url':
        // ALWAYS TRUST ESP32-CAM URL
        updateData.videoUrl = payload;
        break;

      case 'ml_result':
        try {
          const result = JSON.parse(payload);
          updateData.lastMlLabel = result.label;
          updateData.lastMlConfidence = result.confidence;

          // If camera confirms a car, promote to VEHICLE_DETECTED
          if ((result.label === 'car' || result.label === 'vehicle') && parseFloat(result.confidence) >= 0.5) {
            // Ensure active session
            let session = await getActiveParkingSession(nodeId);
            if (!session) session = await createParkingSession(nodeId);

            // Update DB state
            await updateParkingState(nodeId, 'VEHICLE_DETECTED', session.id);
            await updateSessionTimestamp(session.id, 'vehicle_detection_time');

            // Publish timer to node to start violation countdown (30s)
            try {
              await publishMqtt(`node/${nodeId}/cmd/violation_timer`, '30');
            } catch (e) {
              console.error('❌ Failed to publish violation_timer:', e.message || e);
            }

            // Broadcast to front-end via Socket.IO
            if (socketService) {
              socketService.emit('parking_state_change', {
                nodeId,
                state: 'VEHICLE_DETECTED',
                timestamp: new Date(),
                confidence: result.confidence,
                message: '🚗 Vehicle Detected - Timer Running',
                timerDuration: 30
              });
            }
          }
        } catch (e) {
          console.error('❌ Failed to parse ml_result:', e.message || e);
        }
        break;
    }
  }

  const node = await upsertNode(updateData);
  const event = await insertEvent({
    nodeId,
    topic,
    payload,
    eventType
  });

  if (socketService) {
    socketService.emit('mqtt_event', {
      nodeId,
      domain,
      action,
      payload,
      node,
      createdAt: event.created_at
    });
  }
}

export function publishMqtt(topic, message) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('MQTT not connected');
  }

  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, message, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}
