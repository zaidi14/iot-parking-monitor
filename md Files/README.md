# IoT Parking Monitor

A lightweight, modular system for monitoring parking occupancy using microcontrollers and sensors, with a cloud/backend service and a responsive web dashboard. This repository contains the firmware, backend integration examples, and dashboard code to deploy a complete parking monitoring solution.

Status
- Project: Active
- Last updated: 2025-12-31

Table of Contents
- Overview
- Key Features
- System Architecture
- Hardware
- Firmware
- Backend & Communication
- Dashboard
- Quick Start
- Configuration
- Data Format
- Troubleshooting
- Contributing
- License

Overview

IoT Parking Monitor is designed to detect and report parking spot occupancy in real time. The system is modular so you can use different sensors (ultrasonic, magnetic, IR, camera) and different microcontrollers (ESP32, ESP8266, Raspberry Pi Pico W) depending on your needs and budget.

Key Features
- Real-time occupancy detection and reporting
- Lightweight firmware for microcontrollers
- MQTT and HTTP support for transport
- Simple API-compatible backend examples
- Responsive dashboard for monitoring and historical view
- Modular and easy to extend

System Architecture

1. Sensors & Microcontroller: Each parking spot is instrumented with a sensor connected to a microcontroller that runs the firmware. The firmware reads sensor values, debounces and filters the data, decides occupancy, and publishes events.
2. Transport: Firmware can publish to an MQTT broker (recommended) or send HTTP POSTs to a backend endpoint.
3. Backend: Receives telemetry, stores events (time-series or relational DB), and exposes an API for the dashboard.
4. Dashboard: Web app that subscribes to backend APIs (or MQTT via WebSocket) and displays spot status, counts, and history.

Hardware
- Microcontroller: ESP32 / ESP8266 / Raspberry Pi Pico W
- Common sensors: Ultrasonic (HC-SR04 or similar), Magnetic reed or hall-effect sensor, IR distance sensors
- Power: 5V USB / 3.3V regulated supply (depending on MCU)
- Optional: Enclosures, weatherproofing for outdoor deployments

Firmware
- Purpose: read sensor(s), apply filtering and occupancy thresholds, publish messages
- Transport: MQTT (preferred) or HTTP
- Message payload (JSON example):
  {
    "device_id": "esp32-spot-01",
    "spot_id": "P1-01",
    "occupied": true,
    "confidence": 0.95,
    "timestamp": "2025-12-31T12:34:56Z"
  }

Backend & Communication
- MQTT: Use Mosquitto or any cloud MQTT provider. Topics can be hierarchical: parking/<lot>/<spot>/state
- HTTP: POST to /api/spot/state with JSON payload
- Storage: Time-series DB (InfluxDB, Timescale) or relational DB (Postgres/SQLite) depending on needs
- API: Provide endpoints for current state, historical events, and statistics

Dashboard
- Web dashboard (React / Vue / plain HTML+JS) that consumes backend API
- Shows map/grid of spots, real-time updates, and charts for historical occupancy
- Simple authentication (API key or basic auth) recommended for deployments

Quick Start (Example using MQTT + Node script)

Prerequisites
- An MQTT broker (local Mosquitto or cloud broker)
- Node.js (optional for running simple backend)
- Microcontroller with flashed firmware

1. Configure Firmware
- Set MQTT broker host, port, topic prefix, and device/spot IDs in firmware config.

2. Start MQTT broker
- For Mosquitto (local):
  - Install Mosquitto and run: mosquitto

3. Example Node.js backend (subscribe and log)
- Install dependencies:
  npm install mqtt express
- Example subscriber (save as mqtt-logger.js):
  const mqtt = require('mqtt')
  const client = mqtt.connect('mqtt://localhost:1883')
  client.on('connect', () => client.subscribe('parking/+/+/state'))
  client.on('message', (topic, msg) => console.log(topic, msg.toString()))
- Run: node mqtt-logger.js

Configuration
- Firmware: edit config.h or settings.json depending on the firmware to set:
  - WIFI_SSID / WIFI_PASS
  - MQTT_BROKER / MQTT_PORT
  - TOPIC_PREFIX (e.g., "parking/lot01")
  - DEVICE_ID / SPOT_ID
- Backend: set broker URL or API endpoint and credentials

Data Format (recommended)
- Topic: parking/<lot_id>/<spot_id>/state
- Payload (JSON):
  {
    "device_id": "esp32-spot-01",
    "spot_id": "P1-01",
    "occupied": true,
    "confidence": 0.95,
    "rssi": -62,
    "battery": 3.7,
    "timestamp": "2025-12-31T12:34:56Z"
  }

Troubleshooting
- No messages from device: check Wi-Fi credentials and broker accessibility.
- Flapping occupancy: increase debounce/window or change sensor threshold.
- Incorrect measurements: verify sensor wiring and calibration.

Contributing
- Fork the repo, create a feature branch, and open a pull request.
- Write clear commit messages and include documentation for changes.
- Issues and feature requests are welcome.

License
- This repository uses the MIT License. See LICENSE file for details.

Contact
- Maintainer: zaidi14 (GitHub)
- For questions, open an issue or contact via GitHub profile.

Notes
- This README is intentionally generic to remain adaptable. If you want, I can tailor the sections to exactly match your current implementation (firmware language, backend stack, database, and dashboard stack). Tell me which components you used and I will update the README accordingly.
