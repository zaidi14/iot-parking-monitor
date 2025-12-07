import mqtt from 'mqtt';
import dotenv from 'dotenv';
import { upsertNode, insertEvent, logViolation } from '../config/database.js';

dotenv.config();

let mqttClient = null;
let socketService = null;

export function initMqtt(io) {
  socketService = io;
  const options = {
    clientId: `parking_backend_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 1000
  };

  if (process.env.MQTT_USERNAME) {
    options.username = process.env.MQTT_USERNAME;
    options.password = process.env.MQTT_PASSWORD;
  }

  const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
  mqttClient = mqtt.connect(mqttUrl, options);

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    const topics = [
      'node/+/status',
      'node/+/info',
      'node/+/parking_state',
      'node/+/alerts',
      'node_cam/+/video_url',
      'node/+/sensor/distance'
    ];
    topics.forEach((topic) => {
      mqttClient.subscribe(topic, (err) => {
        if (!err) console.log(`📡 Subscribed to ${topic}`);
      });
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      await handleMqttMessage(topic, message.toString());
    } catch (error) {
      console.error('❌ Error:', error);
    }
  });

  return mqttClient;
}

async function handleMqttMessage(topic, payload) {
  console.log(`📩 MQTT: ${topic} -> ${payload}`);
  const topicParts = topic.split('/');
  let nodeId, eventType;

  if (topic.startsWith('node_cam/')) {
    nodeId = topicParts[1];
    eventType = 'video_url';
  } else {
    nodeId = topicParts[1];
    eventType = topicParts[2];
  }

  const updateData = { nodeId };

  switch (eventType) {
    case 'status':
      updateData.lastStatus = payload;
      break;

    case 'info':
      try {
        const info = JSON.parse(payload);
        updateData.type = info.type;
        updateData.hasCam = info.hasCam;
        updateData.location = info.location;
      } catch (e) {}
      break;

    case 'parking_state':
      updateData.lastParkingState = payload;
      
      // Log violation
      if (payload === 'violation') {
        await logViolation(nodeId, 'parking_violation', 'Vehicle parked beyond time limit');
      }
      break;

    case 'video_url':
      updateData.lastVideoUrl = payload;
      break;

    case 'alerts':
      if (payload === 'violation') {
        await logViolation(nodeId, 'alert', 'Violation alert triggered');
      }
      break;

    case 'sensor':
      // Handle sensor data (ultrasonic distance)
      break;
  }

  const node = await upsertNode(updateData);
  const event = await insertEvent({ nodeId, topic, payload, eventType });

  if (socketService) {
    socketService.emit('mqtt_event', {
      nodeId,
      topic,
      eventType,
      payload,
      createdAt: event.created_at,
      node
    });
  }
}

export function publishMqtt(topic, message) {
  if (!mqttClient || !mqttClient.connected) throw new Error('MQTT client not connected');
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, message, (err) => {
      if (err) reject(err);
      else {
        console.log(`📤 Published: ${topic}`);
        resolve();
      }
    });
  });
}
