# ESP32-CAM ML Integration - Setup Checklist

## ✅ Pre-Installation

- [ ] You have ESP32-CAM connected via USB
- [ ] Arduino IDE is installed
- [ ] Board library: `esp32` by Espressif Systems (v2.0.4+)
- [ ] All Arduino Sketches compiled before (no missing dependencies)

---

## ⚙️ Installation Steps

### Step 1: Add ML Library to Arduino IDE

**Option A: From ZIP (Recommended)**
```
1. Arduino IDE → Sketch → Include Library → Add .ZIP Library...
2. Browse to: iot-parking-monitor/ESP32/ML_Model/
3. Wait for library to be added (~10 seconds)
4. ✅ Verify: Check status bar shows "Library added successfully"
```

**Option B: Manual Copy**
```
1. Copy folder: iot-parking-monitor/ESP32/ML_Model/illegal-parking-car-detection_inferencing/
2. To: ~/Arduino/libraries/
3. Restart Arduino IDE
4. ✅ Verify: Shows in Sketch → Include Library menu
```

### Step 2: Configure Arduino IDE for ESP32-CAM

**Board Settings:**
```
Board: ESP32 Dev Module (or ESP32-CAM)
Flash Size: 4MB
Flash Frequency: 80 MHz
Upload Speed: 921600
Port: COM3 (or your ESP32 port)
```

### Step 3: Compile & Upload Code

**In Arduino IDE:**
```
1. File → Open → iot-parking-monitor/ESP32/ESP32-CAM/ESP32-CAM-ino
2. Sketch → Verify ✓ (should compile without errors)
3. Sketch → Upload (may take 30-60 seconds)
4. Monitor → Serial Monitor (to watch startup)
```

**Expected Startup Output:**
```
🚀 IoT Parking Monitor - ESP32-CAM starting...
📊 ML Model: Illegal Parking Car Detection
🎯 ML Input Size: 96x96
✅ WiFi Connected
192.168.1.103
📷 Camera Ready
📡 ESP32-CAM MQTT connected
```

---

## 🧪 Testing Phase

### Test 1: WiFi Connection
```
Expected: Serial shows "✅ WiFi Connected" + IP address
Action if fails: Check WiFi SSID/password in code
```

### Test 2: Camera Initialization
```
Expected: Serial shows "📷 Camera Ready"
Action if fails: Check camera cable connection, reset ESP32
```

### Test 3: MQTT Connection
```
Expected: Serial shows "📡 ESP32-CAM MQTT connected"
Action if fails: Check MQTT broker IP (192.168.1.110) in code
```

### Test 4: Object Detection + ML Inference
```
Action: Trigger ultrasonic sensor (object < 30cm away)
Expected output:
  🎥 Object detected by sensor - running ML inference...
  🚗 Detected: car (0.92)
  🎯 ML Result: CAR (Confidence: 0.92)
  ✅ Car confirmed - published to backend
  
Action if fails: Check MQTT topic subscriptions
```

### Test 5: False Positive Filtering
```
Action: Hold non-car object near sensor (hand, bag, etc.)
Expected output:
  🎥 Object detected by sensor - running ML inference...
  📊 other: 0.85
  🎯 ML Result: NOT CAR (Confidence: 0.15)
  ❌ Not a car - discarding detection
  
Action if fails: Model might not be loading correctly
```

### Test 6: Video Streaming
```
Action: Trigger violation, click "📹 Relay Video" on frontend
Expected: Video modal shows live camera feed
Action if fails: Check if stream is enabled (MQTT messages)
```

---

## 🔍 Troubleshooting

### ❌ "Cannot find library"

**Symptom**: Compilation error: `fatal error: illegal-parking-car-detection_inferencing.h: No such file or directory`

**Solution**:
```bash
# Verify library was copied correctly
ls ~/Arduino/libraries/ | grep illegal-parking

# If not found, manually copy:
cp -r iot-parking-monitor/ESP32/ML_Model/illegal-parking-car-detection_inferencing \
    ~/Arduino/libraries/

# Restart Arduino IDE
```

---

### ❌ "ML inference failed: -1"

**Symptom**: Serial shows: `❌ ML inference failed: -1`

**Cause**: Memory issue or model not initializing

**Solution**:
```
1. Check: Serial shows "📊 ML Model: Illegal Parking Car Detection"
2. If missing, library didn't load → reinstall
3. If present, check PSRAM is enabled
4. Try: Reset ESP32 (disconnect USB 10s, reconnect)
```

---

### ❌ "Always detects car (Confidence = 1.0)"

**Symptom**: Every object is detected as car with 100% confidence

**Cause**: Model not loading, using dummy code path

**Solution**:
```cpp
// Check if this code is being used (not the dummy 0.88):
Serial.printf("🎯 ML Result: %s (Confidence: %.2f)\n", 
             isCar ? "CAR" : "NOT CAR", confidence);

// If you see this message with varying confidence -> working!
// If you see 1.0 always -> model not loading
```

---

### ❌ "Video stops during inference"

**Symptom**: Video stream freezes for 500ms when ML inference runs

**Cause**: ML inference is CPU-blocking (normal!)

**Solution**:
```
This is expected behavior. ML inference takes:
- Frame capture: ~50ms
- ML processing: ~300-500ms
- Total: ~350-550ms

Video stream will resume after inference completes.
For production: Consider multi-threaded inference (advanced).
```

---

### ❌ "MQTT messages not received"

**Symptom**: No MQTT output in Serial Monitor

**Cause**: MQTT connection failed or topic mismatch

**Solution**:
```
1. Verify MQTT broker is running:
   mosquitto (or check docker container)

2. Check IP address in code:
   const char* mqtt_server = "192.168.1.110";  // CHANGE if needed

3. Check topics match:
   Publishing: node/parking_zone_c1/cam/ml_result
   Subscribing: node/parking_zone_c1/cam/cmd/#

4. Monitor MQTT traffic:
   mosquitto_sub -h 192.168.1.110 -t 'node/+/+/+'
```

---

## 🎯 Performance Validation

### Serial Monitor Checklist
- [ ] Startup message appears
- [ ] ML model input size displayed (96x96)
- [ ] WiFi connected with IP
- [ ] Camera ready message
- [ ] MQTT connected message
- [ ] Object detection triggers ML inference
- [ ] ML results show varying confidence (not always 1.0)
- [ ] Car detections (> 0.5) show "CAR"
- [ ] Non-cars show "NOT CAR"

### Real-World Testing
- [ ] Park actual car in zone → Timer starts
- [ ] Place hand/object near sensor → No timer (filtered)
- [ ] Drive car through zone → Detection captured
- [ ] Violation triggers buzzer & LED
- [ ] Video streams when violation active
- [ ] Video shows actual parking zone

### Timing Validation
```
Sensor detection → Backend → ML inference → Timer start
Should take ~600-800ms total

Expected timeline:
t=0ms:    Sensor triggers
t=100ms:  Backend publishes MQTT
t=150ms:  ESP32-CAM receives & captures frame
t=650ms:  ML inference complete
t=700ms:  Result published to backend
t=750ms:  Timer starts on frontend
```

---

## 📝 Configuration Options

### Adjust ML Confidence Threshold
```cpp
// In ESP32-CAM-ino, line ~120
bool isCar = carConfidence > 0.5;  // Change this value

// Recommended values:
// 0.3  = Sensitive (more detections, more false positives)
// 0.5  = Balanced (recommended - default)
// 0.7  = Strict (fewer detections, fewer false positives)
```

### Change MQTT Topic
```cpp
// In callback function
if (t.endsWith("/cam/object_present")) {  // This topic

// Must match ESP32-MAIN's publication:
// node/{nodeId}/cam/object_present
```

### Modify WiFi Credentials
```cpp
const char* ssid = "Your_WiFi_SSID";
const char* password = "Your_WiFi_Password";
```

### Update MQTT Broker
```cpp
const char* mqtt_server = "192.168.1.110";  // Broker IP
const int mqtt_port = 1883;                  // Broker port
const char* mqtt_user = "mojiz";             // Username
const char* mqtt_password = "1735";          // Password
```

---

## ✨ Validation Checklist

### ✅ System Ready When:
- [ ] Code compiles without errors
- [ ] ESP32-CAM connects to WiFi
- [ ] ESP32-CAM connects to MQTT broker
- [ ] ML library is loaded (shows in startup)
- [ ] Test car detection returns varying confidence (not always 1.0)
- [ ] False objects are filtered (confidence < 0.5)
- [ ] Video stream works on violation
- [ ] Timer starts only for real cars

---

## 📞 Support Info

If stuck:

1. **Check Serial Monitor**
   - Is ESP32-CAM showing startup messages?
   - What's the last message before stopping?

2. **Test Each Component**
   - WiFi: Does it say "WiFi Connected"?
   - Camera: Does it say "Camera Ready"?
   - MQTT: Does it say "MQTT connected"?
   - ML: Does it run inference with varying results?

3. **Verify Hardware**
   - ESP32-CAM powered via USB
   - Camera module cable secure
   - No loose connections

4. **Check Code Paths**
   - ML library is in Arduino/libraries/
   - Include path is correct
   - Callback function is being called

---

## 🎊 Success Indicator

When you see this in Serial Monitor → **System is working!**

```
🚀 IoT Parking Monitor - ESP32-CAM starting...
📊 ML Model: Illegal Parking Car Detection
🎯 ML Input Size: 96x96
✅ WiFi Connected
192.168.1.103
📷 Camera Ready
📡 ESP32-CAM MQTT connected
🎥 Object detected by sensor - running ML inference...
🚗 Detected: car (0.92)
🎯 ML Result: CAR (Confidence: 0.92)
✅ Car confirmed - published to backend
```

---

**Version**: 1.0  
**Date**: December 29, 2025  
**Status**: Ready for Deployment ✅
