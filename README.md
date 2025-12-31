# IoT Parking Monitor

A repository containing an end-to-end parking-spot monitoring reference implementation. The repo includes ESP32 firmware assets/guides, a Node.js backend, a React/TypeScript frontend, and several design and ML integration documents.

This README is a concise index of what is actually present in the repository and where to find the implementation and documentation.

Contents (high-level)
- Documentation and design notes:
  - ARCHITECTURE.md
  - CHECKLIST.md
  - DELIVERY_SUMMARY.md
  - DOCS_INDEX.md
  - IMPLEMENTATION_SUMMARY.md
  - QUICK_START.md
  - PARKING_SETUP_GUIDE.md
  - ESP32_INTEGRATION_GUIDE.md
  - README_ML_INTEGRATION.md
  - ML_INDEX.md
  - ML_QUICK_REFERENCE.md
  - ML_SUMMARY.md
  - ML_DEPLOYMENT_STATUS.txt
  - START_HERE_ML.md
- Code and components:
  - ESP32/ (firmware / integration resources)
  - backend/ (Node.js backend)
  - frontend/ (React / TypeScript frontend)
  - frontend_backup/

Important docs to read first
- ARCHITECTURE.md — canonical system architecture: data flow diagrams, ESP32 hardware layer, network/transport (MQTT / HTTP / Socket.IO), backend state machine, PostgreSQL schema, frontend state management and event flow, API endpoint summary, timing sequences, and DB schema examples. This file contains the detailed sequence diagrams, state transitions, and SQL schema used by the project.
- QUICK_START.md — step-by-step quick-start instructions present in the repository.
- ESP32_INTEGRATION_GUIDE.md and ESP32/ — firmware integration notes and ESP32-specific files.
- ML-related files (README_ML_INTEGRATION.md, ML_INDEX.md, START_HERE_ML.md, ML_QUICK_REFERENCE.md, ML_SUMMARY.md, ML_DEPLOYMENT_STATUS.txt) — documentation and status for ML integration and deployment included in the repo.

What the repository contains (facts pulled from files)
- An ESP32-targeted edge implementation and integration guide (see ESP32_INTEGRATION_GUIDE.md and ESP32 directory).
- A Node.js/Express-style backend design (API routes and Socket.IO events are described in ARCHITECTURE.md).
- A React/TypeScript frontend (architecture and hooks described in ARCHITECTURE.md; frontend/ directory present).
- Database schema examples (PostgreSQL schema for nodes, parking_sessions and violation_logs are in ARCHITECTURE.md).
- API endpoint summaries and event flows (POST /sensor/detect, POST /vehicle/detect, POST /violation/report, POST /violation/resolve, GET /parking/session, POST /video/relay — documented in ARCHITECTURE.md).
- Real-time behavior and state machine (states IDLE → SOMETHING_DETECTED → VEHICLE_DETECTED → VIOLATION and timing details are documented in ARCHITECTURE.md).
- ML integration documentation and status files (see ML_* files).

Quick pointers
- To understand system internals (state machine, sequence diagrams, DB schema, API): read ARCHITECTURE.md.
- For a quick hands-on setup: read QUICK_START.md.
- For ESP32 firmware integration and device-side details: read ESP32_INTEGRATION_GUIDE.md and inspect the ESP32/ directory.
- For frontend behavior, Socket.IO events, and React hooks: read ARCHITECTURE.md and inspect frontend/.
- For ML model and deployment notes: read README_ML_INTEGRATION.md, ML_INDEX.md, and START_HERE_ML.md.

Repository language composition (for context)
- Primary languages reported in the repo: C (majority), C++, Assembly, TypeScript, JavaScript, CMake. This reflects firmware and native code alongside the frontend/backend code present in the repository.

Contributing & next steps
- The repo contains contributor-facing docs (CHECKLIST.md, DELIVERY_SUMMARY.md). Follow those when contributing.
- For changes affecting firmware, backend, or frontend, update the appropriate directory and the related documentation files.

Maintainer / Contact
- Repository owner: zaidi14 (GitHub)

Where to look next
1. ARCHITECTURE.md — read this first for full technical details.
2. QUICK_START.md — follow to get a running test setup.
3. ESP32_INTEGRATION_GUIDE.md and ESP32/ — for device firmware and integration.
4. frontend/ and backend/ — inspect code and start local development servers as described in QUICK_START.md and implementation docs.
