# ⚡ Quick Start Guide - IoT Parking Violation System

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- ✅ PostgreSQL database running
- ✅ Node.js 16+ installed
- ✅ ESP32 board with sensors connected
- ✅ WiFi network available
- ✅ MQTT broker running

---

## Step 1: Configure Backend (.env)

```bash
cd backend
```

Create `.env` file:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=parking_monitor
PORT=3001
```

### Install & Start Backend

```bash
npm install
npm start
```

✅ You should see:
```
✅ Database schema initialized
✅ Socket.IO set in API routes
🚀 Server listening on 0.0.0.0:3001
```

---

## Step 2: Configure & Start Frontend

```bash
cd frontend
```

Update API base URL in `src/services/api.ts`:
```typescript
const API_BASE_URL = "http://192.168.1.110:3001/api";  // ← Your backend IP
```

### Install & Run

```bash
npm install
npm run dev
```

✅ You should see:
```
  VITE v... ready in ... ms
  ➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in browser

---

## Step 3: Upload ESP32 Firmware

### Install Arduino IDE or PlatformIO

```bash
# Option 1: Arduino IDE
# Download from arduino.cc, install ESP32 board support

# Option 2: PlatformIO (recommended)
pip install platformio
```

### Configure Firmware

Edit `ESP32/ESP32-MAIN/ESP32-MAIN.ino`:

```cpp
// Line 8-9: Your WiFi credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// Line 14-15: Your network addresses
const char* mqtt_server = "192.168.1.110";  // MQTT broker IP
const char* SERVER_IP = "192.168.1.110";    // Backend IP
const int SERVER_PORT = 3001;

// Line 20: Your node ID
const char* NODE_ID = "parking_zone_c1";

// Line 35-36: MQTT credentials
const char* mqtt_user = "mojiz";
const char* mqtt_pass = "1735";
```

### Upload

```bash
# PlatformIO method
cd ESP32/ESP32-MAIN
platformio run --target upload

# Or use Arduino IDE:
# 1. Open ESP32-MAIN.ino
# 2. Tools → Board → ESP32
# 3. Tools → Upload Speed → 921600
# 4. Tools → Port → /dev/ttyUSB0
# 5. Click Upload (→)
```

✅ Serial output should show:
```
🚀 ESP32 Parking Violation System BOOT
✅ Setup complete - System IDLE
✅ WiFi connected
IP: 192.168.1.100
✅ MQTT connected
```

---

## Step 4: Test the System

### Open 3 Terminals

**Terminal 1**: Backend logs
```bash
cd backend && npm start
```

**Terminal 2**: ESP32 Serial Monitor
```bash
# Or open Arduino IDE Serial Monitor at 115200 baud
platformio device monitor --port /dev/ttyUSB0 --speed 115200
```

**Terminal 3**: Frontend (or browser)
```bash
cd frontend && npm run dev
# Open http://localhost:5173
```

---

## Step 5: Trigger Detection

### Test 1: Sensor Detection
Place hand in front of motion sensor

```
Expected ESP32 output:
🔔 Motion detected! Value: 2100 (Threshold: 1500)
📡 Sensor detection notified - HTTP 200

Expected Frontend:
Card shows: 🔔 "Something Detected"
LED state: OFF
```

### Test 2: Vehicle Detection
Move closer / Wave at ultrasonic sensor

```
Expected ESP32 output:
📏 Ultrasonic: 45 cm
🚗 Vehicle detected at 45 cm!
🚗 Vehicle detection notified - HTTP 200

Expected Frontend:
Card shows: 🚗 "Vehicle Detected - Timer Running"
Countdown: 30 → 29 → 28 ...
LED state: BLUE
```

### Test 3: Violation (Wait or Use curl)
Wait 30 seconds, or manually trigger:

```bash
curl -X POST http://localhost:3001/api/nodes/parking_zone_c1/violation/report \
  -H "Content-Type: application/json" \
  -d '{"details": "Test violation"}'
```

```
Expected ESP32 output:
🚨 VIOLATION TRIGGERED!
🔊 Buzzer ON
📡 Violation reported - HTTP 200

Expected Frontend:
Card turns: 🔴 RED "VIOLATION"
Shows: "🚨 Violation: Car Not Moved!"
Button: 📹 "Relay Video" appears
LED state: RED
Buzzer: 3 beeps (if connected)
```

### Test 4: Resolution
Click "Resolve Violation" button

```
Expected Frontend:
Card returns to: ✅ "IDLE"
LED state: GREEN back on
Buzzer: OFF
```

---

## Dashboard Features

### Parking Status Card

Shows current state with:
- 🟢 **IDLE** - Ready for detection
- 🟡 **SOMETHING_DETECTED** - Object sensed
- 🔵 **VEHICLE_DETECTED** - Car confirmed, timer running
- 🔴 **VIOLATION** - Car not moved!

### Real-time Updates

- **State changes** via WebSocket
- **Countdown timer** updates every 100ms
- **Confidence display** from ML model
- **Violation history** modal with full logs

### Action Buttons

- **📹 Relay Video** - Stream camera feed to dashboard
- **✓ Resolve Violation** - Clear violation & reset

---

## Database Tables

After first run, check tables:

```sql
-- PostgreSQL
\dt

-- Should show:
nodes                  -- Node configuration & status
events                 -- MQTT events
violation_logs         -- Violation records (main!)
parking_sessions       -- Current parking sessions
```

### Query Active Violations

```sql
SELECT * FROM violation_logs 
WHERE resolved = false 
ORDER BY created_at DESC;
```

### Clear Test Data

```sql
DELETE FROM parking_sessions;
DELETE FROM violation_logs;
DELETE FROM events;
```

---

## Common Issues & Fixes

### Frontend shows "No nodes detected"
```
❌ Problem: Backend not sending data
✅ Fix:
1. Check backend console for errors
2. Verify ESP32 is connected (check MQTT)
3. Restart backend: npm start
4. Refresh frontend page
```

### WebSocket connection fails
```
❌ Problem: CORS or connection issue
✅ Fix:
1. Check backend is running: http://localhost:3001/health
2. Verify CORS in server.js allows frontend origin
3. Check browser DevTools → Network → WS
```

### ESP32 won't connect to WiFi
```
❌ Problem: Credentials or network
✅ Fix:
1. Verify SSID/password in code
2. Check if 2.4GHz (ESP32 can't use 5GHz)
3. Monitor serial: Watch for "Connecting to WiFi..."
4. Restart ESP32
```

### Timer not showing on frontend
```
❌ Problem: Socket.IO event not received
✅ Fix:
1. Check browser console for errors
2. Verify Socket.IO connected in Console: io.connected
3. Manually test: curl vehicle/detect endpoint
4. Check backend emits 'vehicle_detected'
```

### Buzzer not working
```
❌ Problem: GPIO/MQTT command
✅ Fix:
1. Test GPIO25 independently
2. Check MQTT command received in ESP32 serial
3. Verify buzzer power supply (5V)
4. Test with: mosquitto_pub ... "on"
```

---

## Environment Setup Checklist

- [ ] PostgreSQL running & accessible
- [ ] MQTT broker running (Mosquitto)
- [ ] WiFi credentials updated in ESP32 code
- [ ] Network IPs correct (backend, MQTT, etc)
- [ ] Backend .env configured
- [ ] Frontend API URL correct
- [ ] ESP32 flashed successfully
- [ ] Serial monitor showing "IDLE"

---

## Monitoring Commands

### Check Backend Health
```bash
curl http://localhost:3001/health
# Response: {"status":"ok"}
```

### Check MQTT Connection
```bash
mosquitto_sub -h 192.168.1.110 -u mojiz -P 1735 \
  -t "node/+/status"
# Shows: online
```

### Monitor Live Logs
```bash
# Backend
npm start

# ESP32
platformio device monitor --speed 115200

# Frontend (Browser DevTools)
# F12 → Console tab
```

### Check Database Connection
```bash
psql -h localhost -U postgres -d parking_monitor
```

---

## Port Reference

- **3001** - Backend REST API & Socket.IO
- **5173** - Frontend (Vite dev server)
- **5432** - PostgreSQL
- **1883** - MQTT broker
- **9001** - MQTT WebSocket (optional)

---

## File Locations

```
📁 backend/
├── src/routes/api.js          ← Parking violation endpoints
├── src/config/database.js      ← Schema & queries
└── .env                        ← Config

📁 frontend/
├── src/App.tsx                 ← Main app
├── src/context/ParkingContext  ← State management
├── src/components/ParkingStatusCard ← UI card
└── src/services/api.ts         ← API calls

📁 ESP32/ESP32-MAIN/
└── ESP32-MAIN.ino              ← Firmware

📄 PARKING_SETUP_GUIDE.md       ← Full documentation
📄 ESP32_INTEGRATION_GUIDE.md   ← Technical details
📄 README.md                    ← This file
```

---

## Next Steps

1. **Customize thresholds**:
   - Motion sensor: `MOTION_THRESHOLD = 1500`
   - Detection distance: `DETECTION_DISTANCE = 50cm`
   - Violation timeout: `VIOLATION_TIMEOUT = 30s`

2. **Add ML model** (optional):
   - Replace mock inference in ESP32
   - Add TensorFlow Lite car detection model

3. **Deploy**:
   - Move frontend to production build
   - Deploy backend to server
   - Configure HTTPS/SSL

4. **Scale**:
   - Add multiple parking zones
   - Create zone management dashboard
   - Add analytics & reporting

---

## Support & Debugging

### Enable Debug Logs

**Backend** - Update `server.js`:
```javascript
if (process.env.DEBUG) console.log(...);
```

Run with:
```bash
DEBUG=* npm start
```

**Frontend** - Check Console in DevTools (F12)

**ESP32** - Serial Monitor shows all logs

---

## Performance Tips

1. **Reduce sensor interval** for faster detection:
   ```cpp
   const int SENSOR_INTERVAL = 200;  // 200ms instead of 500ms
   ```

2. **Increase motion threshold** to reduce false positives:
   ```cpp
   const int MOTION_THRESHOLD = 2000;  // More sensitive
   ```

3. **Shorten violation timeout** for faster alerts:
   ```cpp
   const int VIOLATION_TIMEOUT = 15;  // 15 seconds
   ```

---

## You're All Set! 🎉

Your IoT parking violation detection system is now running!

**Quick recap**:
- ✅ Sensor detects motion
- ✅ Camera confirms it's a car
- ✅ Timer countdown starts
- ✅ Buzzer sounds if car doesn't move
- ✅ Dashboard shows red violation card
- ✅ Operator can relay video & resolve

---

## Need Help?

1. Check logs in all 3 terminals
2. Read [PARKING_SETUP_GUIDE.md](./PARKING_SETUP_GUIDE.md)
3. Check [ESP32_INTEGRATION_GUIDE.md](./ESP32_INTEGRATION_GUIDE.md)
4. Verify Hardware connections
5. Test each component separately

**Happy parking monitoring! 🚗** 🚨
