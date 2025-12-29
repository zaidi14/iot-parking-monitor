# 🎯 System Architecture Overview

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ESP32 HARDWARE LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Motion Sensor (GPIO 34)        Ultrasonic (GPIO 32/33)         │
│  └─ Analog Reading: 0-4095     └─ Distance Measurement          │
│  └─ Threshold: 1500             └─ Detection: < 50cm            │
│     │                                │                           │
│     └────────────┬──────────────────┘                           │
│                  │                                               │
│              ┌───▼────────────────────┐                          │
│              │  State Machine         │                          │
│              │ (IDLE / DETECTED /     │                          │
│              │  VEHICLE / VIOLATION)  │                          │
│              └───┬────────────────────┘                          │
│                  │                                               │
│      ┌───────────┼───────────────────┐                          │
│      │           │                   │                          │
│      │ LEDs      │ Buzzer            │ HTTP & MQTT              │
│      │ Green/Red │ PWM Output        │ to Backend               │
│      │ (GPIO26/27)│ (GPIO25)          │                          │
│      │           │                   │                          │
└──────┼───────────┼───────────────────┼──────────────────────────┘
       │           │                   │
       └───────────┴───────────────────┴──────────┐
                                                   │
┌──────────────────────────────────────────────────▼──────────────┐
│                     NETWORK COMMUNICATION                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ MQTT (Mosquitto)  ──┐     ┌─ HTTP REST API (Express) ─┐   │
│  │  - cmd/buzzer        │     │  - POST /sensor/detect      │   │
│  │  - cmd/led           │     │  - POST /vehicle/detect     │   │
│  │  - cmd/reset         │     │  - POST /violation/report   │   │
│  │  - Node status       │     │  - POST /violation/resolve  │   │
│  │  - Distance readings │     │  - POST /video/relay        │   │
│  └──────────────────────┘     │  - GET /parking/session     │   │
│                                └─────────────────────────────┘   │
│                                                                   │
│  ┌─ Socket.IO (WebSocket) ────────────────────────────────────┐ │
│  │  - parking_state_change     (state updates)               │ │
│  │  - vehicle_detected         (with timer info)             │ │
│  │  - violation_detected       (with video URL)              │ │
│  │  - video_relay_start        (stream video)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────┬────────────────────────────────┬─┘
                                │                                │
┌───────────────────────────────▼─────────────────────────────────▼─┐
│                     BACKEND (Node.js/Express)                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  API Routes (src/routes/api.js)                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. /sensor/detect                                            │  │
│  │    └─ Create parking_session (SOMETHING_DETECTED)            │  │
│  │    └─ Update node.last_parking_state                         │  │
│  │    └─ Emit WebSocket event                                   │  │
│  │    └─ Trigger camera start via MQTT                          │  │
│  │                                                               │  │
│  │ 2. /vehicle/detect                                           │  │
│  │    └─ Update session (VEHICLE_DETECTED)                      │  │
│  │    └─ Start 30-second timer                                  │  │
│  │    └─ Emit vehicle_detected with timerDuration               │  │
│  │    └─ Send violation_timer command to ESP32                  │  │
│  │                                                               │  │
│  │ 3. /violation/report                                         │  │
│  │    └─ Update session (VIOLATION)                             │  │
│  │    └─ Create violation_logs entry                            │  │
│  │    └─ Emit violation_detected                                │  │
│  │    └─ Send MQTT: cmd/buzzer → "on"                           │  │
│  │    └─ Send MQTT: cmd/led → OFF                               │  │
│  │                                                               │  │
│  │ 4. /violation/resolve                                        │  │
│  │    └─ Close parking_session                                  │  │
│  │    └─ Send MQTT: cmd/buzzer → "off"                          │  │
│  │    └─ Send MQTT: cmd/led → "on"                              │  │
│  │    └─ Update node.last_parking_state = IDLE                  │  │
│  │                                                               │  │
│  │ 5. /video/relay                                              │  │
│  │    └─ Emit video_relay_start to all clients                  │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  State Management (In-Memory)                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ParkingSession {                                             │  │
│  │   node_id: string                                            │  │
│  │   parking_state: IDLE | SOMETHING_DETECTED | ... | VIOLATION│  │
│  │   detection_time: timestamp                                  │  │
│  │   vehicle_detection_time: timestamp                          │  │
│  │   violation_time: timestamp                                  │  │
│  │   is_active: boolean                                         │  │
│  │ }                                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                     PostgreSQL DATABASE                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Table: nodes                                                       │
│  ├─ id (primary key)                                                │
│  ├─ node_id (unique)                                                │
│  ├─ last_parking_state (IDLE | SOMETHING_DETECTED | ...)           │
│  ├─ last_video_url                                                  │
│  ├─ has_cam (boolean)                                               │
│  └─ updated_at (timestamp)                                          │
│                                                                      │
│  Table: parking_sessions                                            │
│  ├─ id (primary key)                                                │
│  ├─ node_id (foreign key)                                           │
│  ├─ parking_state (current state)                                   │
│  ├─ detection_time (when sensor triggered)                          │
│  ├─ vehicle_detection_time (when camera confirmed)                  │
│  ├─ violation_time (when violation triggered)                       │
│  ├─ is_active (boolean - false when session ends)                   │
│  └─ created_at, updated_at (timestamps)                             │
│                                                                      │
│  Table: violation_logs                                              │
│  ├─ id (primary key)                                                │
│  ├─ node_id (foreign key)                                           │
│  ├─ violation_type (PARKING_VIOLATION)                              │
│  ├─ details (text description)                                      │
│  ├─ resolved (boolean)                                              │
│  ├─ video_url (optional)                                            │
│  └─ created_at (timestamp)                                          │
│                                                                      │
│  Table: events (existing)                                           │
│  ├─ MQTT events from all nodes                                      │
│  └─ Used for historical logging                                     │
│                                                                      │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                    FRONTEND (React/TypeScript)                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ParkingContext (State Management)                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ useParking() Hook provides:                                  │  │
│  │ ├─ sessions[nodeId] - Current session state                 │  │
│  │ ├─ violations[nodeId] - Active violation info               │  │
│  │ ├─ timers[nodeId] - Countdown timer reference               │  │
│  │ ├─ updateSession(nodeId, state)                             │  │
│  │ ├─ setViolation(nodeId, violation)                          │  │
│  │ ├─ startTimer(nodeId, duration, onExpire)                   │  │
│  │ ├─ resetSession(nodeId)                                     │  │
│  │ └─ stopTimer(nodeId)                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Socket.IO Event Listeners                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ socket.on('parking_state_change', (data) => {               │  │
│  │   updateSession(data.nodeId, {                              │  │
│  │     state: data.state,        ← IDLE/DETECTED/VEHICLE/...   │  │
│  │     message: data.message,                                   │  │
│  │     timerDuration: data.timerDuration                        │  │
│  │   })                                                         │  │
│  │ })                                                           │  │
│  │                                                               │  │
│  │ socket.on('vehicle_detected', (data) => {                   │  │
│  │   updateSession(data.nodeId, ...)                           │  │
│  │   startTimer(data.nodeId, 30, () => {                       │  │
│  │     // Timer expired callback                               │  │
│  │   })                                                         │  │
│  │ })                                                           │  │
│  │                                                               │  │
│  │ socket.on('violation_detected', (data) => {                 │  │
│  │   stopTimer(data.nodeId)                                    │  │
│  │   setViolation(data.nodeId, {...})                          │  │
│  │ })                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ParkingStatusCard Component                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Props: nodeId, location                                      │  │
│  │                                                               │  │
│  │ Displays:                                                    │  │
│  │ ├─ State badge (IDLE/DETECTED/VEHICLE/VIOLATION)             │  │
│  │ │  Color: 🟢🟡🔵🔴                                            │  │
│  │ │                                                             │  │
│  │ ├─ Countdown Timer (when VEHICLE_DETECTED)                   │  │
│  │ │  ├─ Circular progress: 30s → 0s                           │  │
│  │ │  ├─ Updates every 100ms                                   │  │
│  │ │  └─ Message: "Violation in: Xs"                           │  │
│  │ │                                                             │  │
│  │ ├─ Confidence Display                                        │  │
│  │ │  └─ Progress bar (0-100%)                                 │  │
│  │ │                                                             │  │
│  │ ├─ Violation Alert (when VIOLATION)                          │  │
│  │ │  ├─ Red background alert box                              │  │
│  │ │  ├─ Warning icon 🚨                                       │  │
│  │ │  ├─ Message: "Car Not Moved!"                             │  │
│  │ │  └─ Action buttons:                                       │  │
│  │ │     ├─ 📹 Relay Video (calls /video/relay)                │  │
│  │ │     └─ ✓ Resolve (calls /violation/resolve)               │  │
│  │ │                                                             │  │
│  │ └─ Timestamp                                                │  │
│  │    └─ Last update time                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  API Service Methods                                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ api.sensorDetected(nodeId, threshold)                       │  │
│  │ api.vehicleDetected(nodeId, confidence, frameData)          │  │
│  │ api.reportViolation(nodeId, videoUrl, details)              │  │
│  │ api.resolveViolation(nodeId, violationId)                   │  │
│  │ api.getParkingSession(nodeId)                               │  │
│  │ api.relayVideo(nodeId, videoUrl)                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## State Transition Diagram

```
                 ┌─────────────────────────┐
                 │                         │
                 │  POWER ON / BOOT        │
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   IDLE STATE     │
                    │  🟢 GREEN LED    │
                    │  BUZZER: OFF     │
                    │  Ready Detection │
                    └────────┬─────────┘
                             │
          ┌──────────────────┤
          │                  │
          │ (Motion > 1500)  │
          │                  │
          ▼                  │
┌──────────────────────────┐ │
│ SOMETHING_DETECTED       │ │
│ 🟡 AMBER LED            │ │
│ Waiting for confirmation │ │
└────────┬─────────────────┘ │
         │                    │
    ┌────┴─────────────────┐  │
    │                      │  │
(Distance)         (No Motion)
(< 50cm)           OR Motion OFF
    │                      │
    │                      └──────────────────────┐
    │                                             │
    ▼                                             │
┌──────────────────────────┐                     │
│ VEHICLE_DETECTED         │                     │
│ 🔵 BLUE LED             │                     │
│ Timer: 30s countdown     │                     │
└────────┬─────────────────┘                     │
         │                                       │
    ┌────┴──────────────┐                       │
    │                   │                       │
(Timer expires)    (Vehicle leaves)            │
(Motion still)     (Distance > 50cm)            │
    │                   │                       │
    │                   └───────────────────────┤
    │                                           │
    ▼                                           │
┌──────────────────────────┐                   │
│ VIOLATION STATE          │                   │
│ 🔴 RED LED              │                   │
│ BUZZER: ON (3 beeps)    │                   │
│ Database: Log violation  │                   │
│ Frontend: Red card       │                   │
└────────┬─────────────────┘                   │
         │                                     │
    ┌────┴──────────────────────────┐          │
    │                               │          │
(User clicks "Resolve")    (Vehicle Leaves)   │
(Manual override)          (Distance > 50cm)   │
    │                               │          │
    └───────────────┬───────────────┘          │
                    │                         │
                    ▼                         │
         ┌──────────────────────┐             │
         │ SEND RESET COMMAND   │             │
         │ ├─ LED ON            │             │
         │ ├─ BUZZER OFF        │             │
         │ └─ DB: is_active=0   │             │
         └──────────┬───────────┘             │
                    │                         │
                    └─────────┬────────────────┴──────┐
                              │                       │
                              ▼                       ▼
                         BACK TO IDLE (state = 'IDLE')
                         Ready for next detection cycle
```

---

## Timing Sequence

```
Time    Event                       ESP32              Backend             Frontend
────────────────────────────────────────────────────────────────────────────────────
0s      System ready               IDLE               Listening           🟢 IDLE

0.5s    User waves hand            Sensor > 1500
        at motion sensor           ├─ POST /sensor/detect
                                   └─ State: SOMETHING_DETECTED

0.6s                                                  ├─ Create session
                                                      ├─ Update state
                                                      └─ Socket: 'parking_state_change'

0.7s                                                                      🔔 Something Detected

1.0s    User moves closer/         Distance < 50cm
        position in front          ├─ POST /vehicle/detect (confidence: 0.92)
                                   └─ State: VEHICLE_DETECTED

1.1s                                                  ├─ Start 30s timer
                                                      ├─ Update session
                                                      └─ Socket: 'vehicle_detected' {duration: 30}

1.2s                                                                      🚗 Vehicle Detected
                                                                          Timer shows: 30s
                                                                          LED: BLUE

1.5s                                                                      Timer: 29s

2.0s                                                                      Timer: 28s

...     (user stays in position)

20s                                                                       Timer: 11s

29.9s                                                                     Timer: 1s

30s     Timer expires!             (Backend timer)
        Vehicle still              ├─ POST /violation/report
        in position                ├─ State: VIOLATION
                                   ├─ Buzzer: ON
                                   └─ Log violation_logs

30.1s                                                  ├─ Create violation entry
                                                      ├─ MQTT: cmd/buzzer → "on"
                                                      ├─ MQTT: cmd/led → OFF
                                                      └─ Socket: 'violation_detected'

30.2s                                                                     🚨 VIOLATION!
                                                                          Card turns RED
                                                                          "Relay Video" button
                                                                          Buzzer sounds
                                                                          LED: RED

35s     User clicks                                   ├─ POST /violation/resolve
        "Resolve Violation"                          ├─ MQTT: buzzer → "off"
                                                      ├─ MQTT: led → "on"
                                                      ├─ Close session
                                                      └─ Socket: 'parking_state_change'

35.1s                                                                     ✅ IDLE
                                                                          Card turns GREEN
                                                                          Timer cleared
                                                                          Ready for next detection

────────────────────────────────────────────────────────────────────────────────────
```

---

## Database Schema Summary

```sql
-- Parking Sessions (Active Tracking)
CREATE TABLE parking_sessions (
  id SERIAL PRIMARY KEY,
  node_id VARCHAR(255),
  parking_state VARCHAR(100),          -- IDLE | SOMETHING_DETECTED | VEHICLE_DETECTED | VIOLATION
  detection_time TIMESTAMP,             -- When sensor triggered
  vehicle_detection_time TIMESTAMP,     -- When camera confirmed
  violation_time TIMESTAMP,             -- When violation triggered
  is_active BOOLEAN DEFAULT true,       -- Session open/closed
  created_at TIMESTAMP DEFAULT NOW,
  updated_at TIMESTAMP DEFAULT NOW
);

-- Violation Logs (Historical Record)
CREATE TABLE violation_logs (
  id SERIAL PRIMARY KEY,
  node_id VARCHAR(255),
  violation_type VARCHAR(100),          -- PARKING_VIOLATION
  details TEXT,                         -- Description
  resolved BOOLEAN DEFAULT false,
  video_url TEXT,                       -- Optional video evidence
  created_at TIMESTAMP DEFAULT NOW
);

-- Nodes (Device Registry)
CREATE TABLE nodes (
  id SERIAL PRIMARY KEY,
  node_id VARCHAR(255) UNIQUE,
  type VARCHAR(100),
  has_cam BOOLEAN DEFAULT false,
  location TEXT,
  last_status VARCHAR(50),              -- online/offline
  last_parking_state VARCHAR(50),       -- Cache of state
  last_video_url TEXT,
  created_at TIMESTAMP DEFAULT NOW,
  updated_at TIMESTAMP DEFAULT NOW
);
```

---

## API Endpoints Summary

| Method | Endpoint | Trigger | State Change | Response |
|--------|----------|---------|--------------|----------|
| POST | `/sensor/detect` | Motion > 1500 | IDLE → SOMETHING_DETECTED | Session created |
| POST | `/vehicle/detect` | Distance < 50cm | SOMETHING → VEHICLE_DETECTED | Timer started (30s) |
| POST | `/violation/report` | Timer expires | VEHICLE → VIOLATION | Violation logged, buzzer on |
| POST | `/violation/resolve` | User action | VIOLATION → IDLE | Buzzer off, session closed |
| GET | `/parking/session` | Query state | - | Current session info |
| POST | `/video/relay` | User clicks button | - | Stream video to dashboard |

---

## Key Features Implemented

✅ **4 Parking States** with visual indicators
✅ **Real-time Timer** countdown (30 seconds)
✅ **Buzzer Control** (on violation detection)
✅ **LED Status** (Green/Blue/Red)
✅ **Database Logging** (violation history)
✅ **WebSocket Events** (live updates)
✅ **Video Relay** (stream camera feed)
✅ **State Persistence** (in database)
✅ **MQTT Commands** (ESP32 control)
✅ **HTTP REST API** (all operations)

---

**Ready to deploy!** 🚀
