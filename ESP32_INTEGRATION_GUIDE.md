# ESP32 Integration & Command Reference

## MQTT Topics for Backend Control

### Command Topics (Backend → ESP32)

```
node/{NODE_ID}/cmd/buzzer        → "on" | "off"
node/{NODE_ID}/cmd/led           → "on" | "off"  
node/{NODE_ID}/cmd/silence       → "1"
node/{NODE_ID}/cmd/reset         → "1"
node/{NODE_ID}/cmd/violation_timer → "30" (duration in seconds)

node_cam/{NODE_ID}/cmd/start_video → "1"
node_cam/{NODE_ID}/cmd/stop_video  → "1"
```

### Status Topics (ESP32 → Backend)

```
node/{NODE_ID}/status            → "online" | "offline"
node/{NODE_ID}/sensor/motion     → integer value
node/{NODE_ID}/sensor/distance   → integer cm
node/{NODE_ID}/ctrl/state        → "IDLE" | "SOMETHING_DETECTED" | "VEHICLE_DETECTED" | "VIOLATION"
```

---

## HTTP Endpoints (ESP32 → Backend)

The ESP32 firmware now makes these HTTP calls:

### 1. Sensor Detection
```http
POST /api/nodes/{nodeId}/sensor/detect
Content-Type: application/json

{
  "threshold": 1800
}
```

**Triggered when**: Motion sensor reading > 1500
**Response**: Creates new parking session in SOMETHING_DETECTED state

### 2. Vehicle Detection
```http
POST /api/nodes/{nodeId}/vehicle/detect
Content-Type: application/json

{
  "confidence": 0.92,
  "frameData": "data:image/jpeg;base64,..."
}
```

**Triggered when**: Ultrasonic distance < 50cm
**Response**: Updates session to VEHICLE_DETECTED, starts 30s timer

### 3. Violation Report
```http
POST /api/nodes/{nodeId}/violation/report
Content-Type: application/json

{
  "videoUrl": "data:image/jpeg;base64,...",
  "details": "Vehicle did not move within timeout period"
}
```

**Triggered when**: Violation timer expires (30 seconds)
**Response**: Updates to VIOLATION state, logs violation, triggers buzzer

---

## State Machine Flowchart

```
                    ┌─────────────────────────────────────┐
                    │           POWER ON / RESET           │
                    └────────────────┬────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  IDLE STATE ✅      │
                          │  LED: GREEN         │
                          │  BUZZER: OFF        │
                          └────────┬────────────┘
                                   │
                    ┌──────────────┐│┌──────────────┐
                    │   Motion      ││   No Motion   │
                    │   > 1500      ││   Detected    │
                    └──┬────────────┘└──────────────┘
                       │ (notify backend)
                       ▼
         ┌──────────────────────────────────┐
         │  SOMETHING_DETECTED STATE 🔔     │
         │  LED: AMBER                      │
         │  Waiting for camera confirmation │
         └─────────┬────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   Motion OFF         Distance < 50cm
   Object moved       (camera detects car)
        │             (notify backend)
        │                   │
        │                   ▼
        │     ┌─────────────────────────────┐
        │     │  VEHICLE_DETECTED 🚗       │
        │     │  LED: BLUE                  │
        │     │  Backend starts 30s timer   │
        │     └────────┬────────────────────┘
        │              │
        │    ┌─────────┴──────────┐
        │    │                    │
        │  Vehicle           Timer expires
        │  Leaves            (no motion)
        │    │                    │
        │    │          (notify backend)
        │    │                    │
        │    │                    ▼
        │    │     ┌───────────────────────┐
        │    │     │  VIOLATION STATE 🚨   │
        │    │     │  LED: RED             │
        │    │     │  BUZZER: ON (3 beeps) │
        │    │     └─────────┬─────────────┘
        │    │               │
        │    │        User clicks "Resolve"
        │    │        or vehicle leaves
        │    │               │
        └────┴───────────────┴──────────────────┐
                                                │
                                    (notify backend)
                                                │
                                                ▼
                                   ┌─────────────────┐
                                   │  RESET TO IDLE  │
                                   │  LED: GREEN     │
                                   │  BUZZER: OFF    │
                                   └─────────────────┘
```

---

## Real-time Flow Example

### Example 1: Normal Violation
```
T=0s    Motion sensor triggered
        └─> POST /sensor/detect
        └─> Backend: SOMETHING_DETECTED
        └─> Frontend: Shows 🔔 "Something Detected"
        └─> LED: OFF (motion detected)

T=0.5s  Ultrasonic detects vehicle at 40cm
        └─> POST /vehicle/detect (confidence: 0.92)
        └─> Backend: VEHICLE_DETECTED, starts 30s timer
        └─> Socket: emit 'vehicle_detected' with timerDuration: 30
        └─> Frontend: Shows 🚗 "Vehicle Detected - Timer Running"
        └─> Frontend: Timer displays 30...29...28...
        └─> LED: BLUE

T=5s    Still no motion, timer counting down: 26 seconds
        └─> Frontend updates: 25...24...23...

T=30s   Timer expires, vehicle still detected
        └─> POST /violation/report
        └─> Backend: VIOLATION, log to DB
        └─> Socket: emit 'violation_detected'
        └─> Frontend: Card turns RED 🚨, "Relay Video" button appears
        └─> ESP32: MQTT cmd/buzzer → "on" (3 beeps)
        └─> LED: RED

T=35s   User clicks "Resolve Violation"
        └─> POST /violation/resolve
        └─> Backend: MQTT cmd/buzzer → "off"
        └─> Backend: MQTT cmd/led → "on"
        └─> Frontend: Resets to IDLE ✅
        └─> Database: violation_logs updated
        └─> LED: GREEN
        └─> Ready for next detection
```

### Example 2: False Alarm (Object Moves Away)
```
T=0s    Motion sensor > 1500
        └─> SOMETHING_DETECTED state

T=1s    Object moves away, motion < 1500
        └─> No ultrasonic detection
        └─> Backend triggers reset
        └─> State: IDLE
        └─> No violation logged
        └─> LED: GREEN
```

### Example 3: Vehicle Leaves Before Timeout
```
T=0s    Vehicle detected
        └─> VEHICLE_DETECTED state
        └─> Timer starts: 30s

T=15s   Vehicle still detected
        └─> Timer: 15s remaining

T=20s   Vehicle leaves (distance > 50cm)
        └─> Motion detection cleared
        └─> No violation triggered
        └─> State: IDLE
        └─> No log entry
```

---

## GPIO Pin Mapping Reference

```c
#define SENSOR_PIN 34        // Analog - Motion sensor input
#define BUZZER_PIN 25        // PWM - Buzzer output
#define LED_GREEN 26         // GPIO - Green LED (detection active)
#define LED_RED 27           // GPIO - Red LED (violation)
#define TRIG_PIN 32          // GPIO - Ultrasonic trigger
#define ECHO_PIN 33          // GPIO - Ultrasonic echo
```

### Voltage Levels
- **3.3V**: GPIO outputs (LEDs, trigger)
- **5V**: Ultrasonic sensor (echo pin with voltage divider)
- **5V+**: Buzzer (if using external driver)

---

## Timing Parameters

```c
const int SENSOR_INTERVAL = 500;       // Check sensors every 500ms
const int MOTION_THRESHOLD = 1500;     // ADC reading threshold
const int DETECTION_DISTANCE = 50;     // cm (ultrasonic)
const int VIOLATION_TIMEOUT = 30;      // seconds
const int BUZZER_FREQ = 2000;          // Hz
```

---

## Debugging Serial Output Examples

### Normal operation:
```
🚀 ESP32 Parking Violation System BOOT
✅ Setup complete - System IDLE
🔌 Connecting to WiFi...
✅ WiFi connected
IP: 192.168.1.100
🔁 Connecting to MQTT...
✅ MQTT connected
📊 Sensor value: 800 (Threshold: 1500)
📊 Sensor value: 850 (Threshold: 1500)
📊 Sensor value: 2100 (Threshold: 1500)   ← Threshold exceeded!
🔔 Motion detected! Value: 2100 (Threshold: 1500)
📡 Sensor detection notified - HTTP 200
```

### Vehicle detected:
```
📏 Ultrasonic: 45 cm
🚗 Vehicle detected at 45 cm!
🚗 Vehicle detection notified - HTTP 200
📹 Camera triggered via MQTT
```

### Violation:
```
⏲️ Violation countdown: 29 seconds
⏲️ Violation countdown: 28 seconds
...
⏲️ Violation countdown: 1 seconds
🚨 VIOLATION TRIGGERED!
🔊 Buzzer ON
📡 Violation reported - HTTP 200
```

### Reset:
```
🔄 RESET command received
🔇 Buzzer OFF
💡 LED ON
✅ Reset notified - HTTP 200
✅ System reset to IDLE
```

---

## Testing Commands

### Test via mosquitto_pub (MQTT)

```bash
# Start buzzer
mosquitto_pub -h 192.168.1.110 -u mojiz -P 1735 \
  -t "node/parking_zone_c1/cmd/buzzer" -m "on"

# Stop buzzer
mosquitto_pub -h 192.168.1.110 -u mojiz -P 1735 \
  -t "node/parking_zone_c1/cmd/buzzer" -m "off"

# Reset system
mosquitto_pub -h 192.168.1.110 -u mojiz -P 1735 \
  -t "node/parking_zone_c1/cmd/reset" -m "1"

# Start violation timer
mosquitto_pub -h 192.168.1.110 -u mojiz -P 1735 \
  -t "node/parking_zone_c1/cmd/violation_timer" -m "30"
```

### Test via curl (HTTP REST)

```bash
# Trigger sensor detection
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/sensor/detect \
  -H "Content-Type: application/json" \
  -d '{"threshold": 2000}'

# Confirm vehicle
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/vehicle/detect \
  -H "Content-Type: application/json" \
  -d '{"confidence": 0.92}'

# Report violation
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/violation/report \
  -H "Content-Type: application/json" \
  -d '{"details": "Test violation"}'

# Resolve violation
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/violation/resolve \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Troubleshooting ESP32

### Sensor readings wrong?
1. Check analog pin mapping
2. Test with: `Serial.println(analogRead(MOTION_SENSOR_PIN))`
3. Adjust `MOTION_THRESHOLD` constant

### Ultrasonic not working?
1. Verify 5V supply
2. Check trigger/echo GPIO pins
3. Add voltage divider on echo if needed (5V → 3.3V)

### WiFi won't connect?
1. Check SSID and password in code
2. Verify network is 2.4GHz (ESP32 limitation)
3. Check router security: try WPA2

### MQTT connection fails?
1. Verify broker address and port
2. Check credentials (mojiz / 1735)
3. Ensure broker is running: `mosquitto -v`

### Buzzer not working?
1. Check GPIO25 is PWM-capable
2. Verify buzzer is powered correctly
3. Test with: `digitalWrite(BUZZER_PIN, HIGH)`

### HTTP calls failing?
1. Check backend is running on port 3001
2. Verify NodeId matches in database
3. Check firewall allows outbound HTTP

---

## Performance Metrics

- **Sensor response time**: ~500ms (configurable)
- **Detection confirmation**: <1s (ultrasonic)
- **API response time**: <100ms (local network)
- **Frontend update**: <50ms (WebSocket)
- **Total latency**: ~1-2 seconds end-to-end

---

## Power Consumption

- **Idle**: ~30mA (WiFi connected)
- **Detecting**: ~50mA (sensor sampling)
- **Buzzer on**: ~200mA (add external driver for high power)
- **LED on**: ~5-10mA each

Use 5V/2A power supply for reliable operation.
