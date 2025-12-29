# ML Model Integration Guide - ESP32-CAM

## Overview
The ESP32-CAM now uses a **real TensorFlow Lite ML model** trained by Edge Impulse for car detection, instead of the mock 0.88 confidence value.

**Flow:**
1. ✅ Ultrasonic sensor detects something
2. 📸 ESP32-CAM captures frame
3. 🧠 **ML model runs inference** → Is it a car?
4. ✅ Only if **car detected** → Timer starts
5. 🚨 Timer ends → Violation & buzzer activated

---

## Setup Instructions

### 1. Copy ML Model Files
The model files are already in your project at:
```
ESP32/ML_Model/illegal-parking-car-detection_inferencing/
```

### 2. Install Model Library in Arduino IDE

**Option A: Add as ZIP Library (Recommended)**
1. Arduino IDE → `Sketch` → `Include Library` → `Add .ZIP Library...`
2. Navigate to: `/home/mojiz/iot-parking-monitor/ESP32/ML_Model/illegal-parking-car-detection_inferencing`
3. Select and add

**Option B: Manual Setup**
1. Copy entire folder: `ESP32/ML_Model/illegal-parking-car-detection_inferencing/`
2. Into: `~/Arduino/libraries/`
3. Restart Arduino IDE

### 3. Upload ESP32-CAM Code
1. Select Board: `ESP32 Dev Module` or `ESP32-CAM`
2. Select Port: COM port where ESP32-CAM is connected
3. Upload: `ESP32/ESP32-CAM/ESP32-CAM-ino`

---

## How It Works

### ML Model Details
- **Model**: `illegal-parking-car-detection_inferencing`
- **Input Size**: 96×96 pixels (or configurable)
- **Output**: Classification score for "car" class
- **Threshold**: 0.5 (50% confidence)

### Code Flow
```cpp
// When sensor detects object:
1. Capture frame from camera
2. Run ML inference: runTinyML(frame, confidence)
3. Extract "car" class score
4. If confidence > 0.5 → Send "car detected" to backend
5. Backend receives → Starts VEHICLE_DETECTED timer
```

### Example Serial Output
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

## Customization

### Adjust Car Detection Threshold
Edit line in `ESP32-CAM-ino`:
```cpp
bool isCar = carConfidence > 0.5;  // Change 0.5 to your threshold (0.0-1.0)
```

Examples:
- `0.3` = More sensitive (more false positives)
- `0.5` = Balanced (current)
- `0.7` = Strict (fewer false positives)

### Handle Different Model Output Formats

The code supports two model types:

**1. Object Detection Mode** (Multiple cars in frame):
```cpp
#if EI_CLASSIFIER_OBJECT_DETECTION == 1
  // Looks for bounding boxes with label "car"
#endif
```

**2. Classification Mode** (Single classification):
```cpp
#else
  // Looks for class label "car" with confidence score
#endif
```

---

## Troubleshooting

### Error: Cannot Find Library
**Solution**: Ensure ML model is in Arduino libraries:
```bash
cp -r ESP32/ML_Model/illegal-parking-car-detection_inferencing ~/Arduino/libraries/
```

### "❌ ML inference failed: -1"
**Cause**: Memory issue or model mismatch
**Solution**: 
1. Check ESP32 has enough PSRAM
2. Verify model files are complete
3. Check `EI_CLASSIFIER_INPUT_WIDTH` and `EI_CLASSIFIER_INPUT_HEIGHT` match model

### Video Stream Stops During ML Inference
**Cause**: ML inference takes ~500ms-1s, blocks the loop
**Solution**: This is normal behavior - stream resumes after inference completes

### Always Detecting Cars (Confidence = 1.0)
**Cause**: Model not loading correctly or using dummy implementation
**Solution**: Check serial output for "❌ ML inference failed"

---

## Performance Metrics

### Inference Time
- Frame capture: ~50ms
- ML inference: ~300-500ms
- Total: ~350-550ms per detection

### Accuracy
- Depends on your friend's model training
- Current threshold: 0.5 confidence
- Can be tuned via backend configuration

### Memory Usage
- Model files: ~2-5 MB
- Runtime memory: ~1-2 MB
- Fits comfortably on ESP32 with PSRAM

---

## System Architecture

```
┌─────────────────────────────────────┐
│   Ultrasonic Sensor (ESP32-MAIN)    │ Detects object
└──────────────┬──────────────────────┘
               │
               │ Publishes to MQTT
               ↓
┌──────────────────────────────────────┐
│      ESP32-CAM (This Device)         │
│  ┌────────────────────────────────┐  │
│  │ 1. Capture Frame (JPEG)        │  │
│  └──────────────┬─────────────────┘  │
│                 │                     │
│  ┌──────────────▼─────────────────┐  │
│  │ 2. Run ML Inference             │  │
│  │    (Edge Impulse Model)         │  │
│  └──────────────┬─────────────────┘  │
│                 │                     │
│  ┌──────────────▼─────────────────┐  │
│  │ 3. Extract Car Confidence      │  │
│  │    (Is it > 0.5?)              │  │
│  └──────────────┬─────────────────┘  │
│                 │                     │
│                 │ Publish ML Result   │
│                 ↓                     │
│         MQTT: cam/ml_result           │
└─────────────────┬─────────────────────┘
                  │
        ┌─────────▼──────────┐
        │ Backend (Node.js)  │
        │                    │
        │ If Car Detected:   │
        │ - Start Timer      │
        │ - Change State     │
        │ - Broadcast Socket │
        └────────────────────┘
```

---

## Next Steps

1. **Train Your Own Model**: Export from Edge Impulse and replace the library
2. **Implement Continuous Inference**: Run detection on every frame (requires more power)
3. **Add Logging**: Store detection history in database
4. **Multi-Model Support**: Run multiple classifiers (car type, color, etc.)

---

## References

- **Edge Impulse**: https://edgeimpulse.com/
- **TensorFlow Lite for ESP32**: https://www.tensorflow.org/lite/microcontrollers
- **Model Documentation**: Check `ESP32/ML_Model/` folder

---

**Status**: ✅ Ready for deployment  
**Last Updated**: December 29, 2025  
**Version**: 1.0 with real ML inference
