# 🚗 IoT Parking Violation Detection System - Setup Guide

## System Overview

This is a complete IoT parking violation detection system with the following flow:

```
SENSOR DETECTS → CAMERA CONFIRMS CAR → TIMER RUNNING → VIOLATION (BUZZER + RED CARD)
```

### States
1. **IDLE** ✅ - Ready for detection (Green LED)
2. **SOMETHING_DETECTED** 🔔 - Sensor triggered, waiting for camera confirmation (Amber)
3. **VEHICLE_DETECTED** 🚗 - Camera confirmed car, timer started (Blue)
4. **VIOLATION** 🚨 - Timer expired, car didn't move (Red, Buzzer on)

---

## Hardware Setup

### ESP32 Main Node
```
GPIO34 (ADC) ───── Motion/Presence Sensor
GPIO25 (PWM) ───── Buzzer (Active High)
GPIO26 (GPIO) ──── LED Green
GPIO27 (GPIO) ──── LED Red
GPIO32 (GPIO) ──── Ultrasonic Trigger (TRIG)
GPIO33 (GPIO) ──── Ultrasonic Echo (ECHO)
```

### Sensor Configuration
- **Motion Sensor**: Analog threshold = 1500
- **Ultrasonic**: Detection distance < 50cm
- **Check Interval**: 500ms
- **Violation Timeout**: 30 seconds (configurable)

---

## Backend Setup

### Database Tables Created

#### `parking_sessions`
Tracks each parking event cycle
```sql
id | node_id | parking_state | detection_time | vehicle_detection_time | violation_time | is_active
```

#### `violation_logs`
Records all violations for history
```sql
id | node_id | violation_type | details | resolved | video_url | created_at
```

### API Endpoints

**POST** `/api/nodes/:nodeId/sensor/detect`
- Called when motion sensor triggers
- Transitions to SOMETHING_DETECTED

**POST** `/api/nodes/:nodeId/vehicle/detect`
- Called when camera confirms car
- Starts violation timer (default 30s)
- Transitions to VEHICLE_DETECTED

**POST** `/api/nodes/:nodeId/violation/report`
- Called when timer expires
- Triggers buzzer
- Transitions to VIOLATION
- Records in violation_logs

**POST** `/api/nodes/:nodeId/violation/resolve`
- Called to reset system
- Stops buzzer
- Returns to IDLE

**GET** `/api/nodes/:nodeId/parking/session`
- Get current session info

**POST** `/api/nodes/:nodeId/video/relay`
- Stream video to dashboard

---

## Frontend Setup

### Components

#### ParkingContext (State Management)
```tsx
- sessions: Track all node sessions
- violations: Track active violations
- timers: Countdown timers for each node
- updateSession(): Update parking state
- setViolation(): Mark violation
- startTimer(): Start countdown
- resetSession(): Reset to IDLE
```

#### ParkingStatusCard (UI Component)
Shows:
- Current state with color coding
- Countdown timer (when VEHICLE_DETECTED)
- Violation alert with "Relay Video" button
- Detection confidence bar
- Timestamp

**Colors**:
- 🟢 Green = IDLE
- 🟡 Amber = SOMETHING_DETECTED
- 🔵 Blue = VEHICLE_DETECTED (timer running)
- 🔴 Red = VIOLATION

### Socket.IO Events

**Received from Backend**:
```javascript
'parking_state_change'    // State transitions
'vehicle_detected'        // Car confirmed
'violation_detected'      // Violation triggered
'video_relay_start'       // Video relay activated
```

---

## Data Flow Diagram

```
ESP32 SENSOR
     ↓
[Motion > 1500?]
     ↓ YES
POST /sensor/detect
     ↓
Backend: Update state → SOMETHING_DETECTED
Socket: Emit parking_state_change
     ↓
Frontend: Card shows 🔔 "Something Detected"
LED: OFF
     ↓
[Camera captures frame]
     ↓
ML INFERENCE
     ↓
[Is it a car?]
     ↓ YES
POST /vehicle/detect
     ↓
Backend: Start 30s timer, update state → VEHICLE_DETECTED
Socket: Emit vehicle_detected with timer info
     ↓
Frontend: Card shows 🚗 "Vehicle Detected - Timer Running"
           Display countdown: 30s → 0s
LED: BLUE (timer countdown)
     ↓
[After 30 seconds, no motion detected]
     ↓
[Timer expires on backend]
     ↓
POST /violation/report
     ↓
Backend: Update state → VIOLATION, record violation
Socket: Emit violation_detected
     ↓
Frontend: Card turns RED 🚨
           "Relay Video" button appears
ESP32: Buzzer sounds (3 beeps)
LED: RED
```

---

## Backend Implementation Details

### Parking Session Lifecycle

1. **Sensor Detection** (SOMETHING_DETECTED)
   ```javascript
   - Create new parking_session
   - Set parking_state = 'SOMETHING_DETECTED'
   - Set detection_time = NOW
   - Update node.last_parking_state
   - Broadcast via Socket.IO
   - Trigger camera start
   ```

2. **Vehicle Confirmed** (VEHICLE_DETECTED)
   ```javascript
   - Update session: parking_state = 'VEHICLE_DETECTED'
   - Set vehicle_detection_time = NOW
   - Start violation timer (30 seconds)
   - Send timer duration to frontend
   - Broadcast state change
   ```

3. **Violation Triggered** (VIOLATION)
   ```javascript
   - Update session: parking_state = 'VIOLATION'
   - Set violation_time = NOW
   - Create violation_log entry
   - Send buzzer ON command to ESP32
   - Broadcast violation_detected with video URL
   - Violation session stays active until resolved
   ```

4. **Resolution** (IDLE)
   ```javascript
   - Send buzzer OFF, LED ON commands
   - Close parking_session (is_active = false)
   - Reset node.last_parking_state = 'IDLE'
   - Frontend resets to IDLE state
   ```

---

## Frontend Implementation Details

### ParkingStatusCard Features

1. **State Display**
   - Icon + State name
   - Color-coded background
   - Status message

2. **Timer Countdown** (when VEHICLE_DETECTED)
   - Circular progress indicator
   - Counts down from 30 to 0
   - Updates every 100ms

3. **Violation Alert**
   - Red background
   - Warning icon
   - "Relay Video" button → calls `/video/relay`
   - "Resolve Violation" button → calls `/violation/resolve`

4. **Confidence Display**
   - Shows ML inference confidence
   - Progress bar visualization

---

## Testing Workflow

### 1. Sensor Detection Test
```bash
# SSH to backend and trigger sensor
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/sensor/detect \
  -H "Content-Type: application/json" \
  -d '{"threshold": 2000}'

# Check frontend: Card should show 🔔 "Something Detected"
```

### 2. Vehicle Detection Test
```bash
# Simulate camera/ML detecting car
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/vehicle/detect \
  -H "Content-Type: application/json" \
  -d '{"confidence": 0.95, "frameData": ""}'

# Check frontend: Card should show 🚗 with countdown timer
```

### 3. Violation Test
```bash
# Wait 30 seconds (or trigger directly)
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/violation/report \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "", "details": "Test violation"}'

# Check:
# - Frontend card turns RED 🚨
# - "Relay Video" button appears
# - ESP32 buzzer sounds
# - Database logs violation
```

### 4. Resolution Test
```bash
# Click "Resolve Violation" button or:
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/violation/resolve \
  -H "Content-Type: application/json" \
  -d '{}'

# Check:
# - Card returns to GREEN ✅ "IDLE"
# - Buzzer stops
# - LED turns back on
```

---

## Environment Variables (.env)

Backend:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=parking_monitor
MQTT_HOST=192.168.1.110
MQTT_PORT=1883
PORT=3001
```

ESP32 (in code):
```cpp
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* mqtt_server = "192.168.1.110";
const char* NODE_ID = "parking_zone_c1";
```

---

## Real-time Communication Flow

### WebSocket Events

**From Backend → Frontend**:
```javascript
socket.emit('parking_state_change', {
  nodeId: 'parking_zone_c1',
  state: 'VEHICLE_DETECTED',      // IDLE | SOMETHING_DETECTED | VEHICLE_DETECTED | VIOLATION
  timestamp: Date,
  message: '🚗 Vehicle Detected - Timer Running',
  timerDuration: 30
});

socket.emit('violation_detected', {
  nodeId: 'parking_zone_c1',
  state: 'VIOLATION',
  videoUrl: 'data:image/jpeg;...',
  sessionId: 123,
  message: '🚨 Violation: Car Not Moved!'
});
```

**From Frontend → Backend**:
```javascript
api.sensorDetected(nodeId, threshold);
api.vehicleDetected(nodeId, confidence, frameData);
api.reportViolation(nodeId, videoUrl, details);
api.resolveViolation(nodeId, violationId);
api.relayVideo(nodeId, videoUrl);
```

---

## Configuration Options

### Backend
- **Violation Timeout**: Change in `VIOLATION_TIMEOUT` (seconds)
- **Check Interval**: Change `SENSOR_INTERVAL` (ms)

### ESP32
- **Motion Threshold**: Line 46 - `MOTION_THRESHOLD = 1500`
- **Detection Distance**: Line 50 - `DETECTION_DISTANCE = 50` cm
- **Violation Timer**: Line 41 - `VIOLATION_TIMEOUT = 30` seconds

### Frontend
- **Timer Duration Display**: Auto-pulls from backend
- **Colors**: Edit [ParkingStatusCard.css](src/components/ParkingStatusCard.css)

---

## Troubleshooting

### Frontend not updating states?
1. Check WebSocket connection: Look for 🔌 in console
2. Verify Socket.IO in backend is initialized
3. Check CORS settings in Express

### ESP32 not detecting sensor?
1. Check GPIO pin mapping
2. Verify ADC readings: `analogRead(MOTION_SENSOR_PIN)`
3. Adjust `MOTION_THRESHOLD` value
4. Test with `Serial.println()` debugging

### Buzzer not sounding on violation?
1. Check GPIO25 is connected to buzzer
2. Verify PWM frequency: `BUZZER_FREQ = 2000`
3. Check MQTT command received: Look for `cmd/buzzer`

### Timer not displaying?
1. Check `timerDuration` is sent from backend
2. Verify state = 'VEHICLE_DETECTED'
3. Check JavaScript Date calculations

---

## File Structure

```
backend/
├── src/
│   ├── server.js
│   ├── routes/api.js (⭐ Parking endpoints here)
│   ├── config/database.js (⭐ Parking tables here)
│   └── services/mqttService.js
├── .env
└── package.json

frontend/
├── src/
│   ├── App.tsx (⭐ Main app with Socket.IO listeners)
│   ├── components/
│   │   ├── ParkingStatusCard.tsx (⭐ NEW - Status display)
│   │   └── ParkingStatusCard.css (⭐ NEW - Styling)
│   ├── context/
│   │   └── ParkingContext.tsx (⭐ NEW - State management)
│   └── services/api.ts (⭐ API helpers)
└── package.json

ESP32/
└── ESP32-MAIN/
    └── ESP32-MAIN.ino (⭐ Firmware with states & HTTP calls)
```

---

## Next Steps

1. **Flash ESP32 Firmware**
   - Update WiFi/MQTT credentials
   - Verify GPIO pins match your hardware
   - Test sensor readings

2. **Start Backend**
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Start Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Monitor Logs**
   - Backend: `node src/server.js`
   - Frontend: Browser DevTools Console
   - ESP32: Serial Monitor at 115200 baud

5. **Test End-to-End**
   - Place object in front of sensor
   - Watch state transitions on dashboard
   - Verify timer countdown
   - Confirm buzzer sounds on violation

---

## API Reference

### Sensor Detection
```
POST /api/nodes/:nodeId/sensor/detect
Body: { threshold: number }
Response: { success: true, session: { ... } }
```

### Vehicle Confirmation
```
POST /api/nodes/:nodeId/vehicle/detect
Body: { confidence: 0-1, frameData: string }
Response: { success: true, session: { ... } }
```

### Violation Report
```
POST /api/nodes/:nodeId/violation/report
Body: { videoUrl?: string, details?: string }
Response: { success: true, violation: { ... }, session: { ... } }
```

### Violation Resolution
```
POST /api/nodes/:nodeId/violation/resolve
Body: { violationId?: string }
Response: { success: true }
```

### Get Session Info
```
GET /api/nodes/:nodeId/parking/session
Response: { id, node_id, parking_state, detection_time, ... }
```

### Video Relay
```
POST /api/nodes/:nodeId/video/relay
Body: { videoUrl?: string }
Response: { success: true }
```

---

## License

MIT License - Feel free to customize for your use case!
