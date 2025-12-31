# IoT Parking Monitor

A comprehensive IoT solution for smart parking management using ESP32 sensors, MQTT communication, and a real-time web dashboard.

## Overview

The IoT Parking Monitor system detects vehicles in parking spaces using ultrasonic sensors connected to ESP32 microcontrollers. The system communicates via MQTT, stores data in PostgreSQL, and provides a real-time web interface for monitoring and managing parking spaces.

## System Architecture

```
ESP32 Sensors (Hardware Layer)
    ↓
MQTT Broker (Communication)
    ↓
Express Backend (API & WebSocket)
    ↓
PostgreSQL Database
    ↓
React Frontend (Real-time Dashboard)
```

## Project Structure

```
iot-parking-monitor/
├── backend/              # Node.js Express server
│   ├── src/
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── database_init.js
│   │   ├── routes/
│   │   │   └── api.js
│   │   └── services/
│   │       └── mqttService.js
│   └── package.json
├── frontend/             # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── components/
│   ├── vite.config.js
│   ├── tsconfig.json
│   └── package.json
├── ESP32/                # Hardware firmware
│   ├── ESP32-MAIN/
│   │   └── ESP32-MAIN.ino
│   └── firmware code
└── README.md
```

## Components

### 1. ESP32 Hardware (`ESP32/ESP32-MAIN/ESP32-MAIN.ino`)

**Features:**
- WiFi connectivity
- MQTT client for real-time data transmission
- Ultrasonic sensor for vehicle detection
- LED indicators (Green: Available, Red: Occupied)
- Buzzer for alerts
- Configurable detection distance and violation times

**Hardware Connections:**
- **Buzzer:** GPIO 25
- **Green LED:** GPIO 26
- **Red LED:** GPIO 27
- **Ultrasonic Trigger:** GPIO 32
- **Ultrasonic Echo:** GPIO 33

**Configuration:**
Update the following in the sketch:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "MQTT_BROKER_IP";
const int mqtt_port = 1883;
const char* node_id = "esp32_sensor_001";
const char* node_location = "Zone A-1";
```

### 2. Backend (`backend/`)

**Tech Stack:**
- Node.js with Express.js
- MQTT client for sensor communication
- Socket.IO for real-time updates
- PostgreSQL for data persistence
- CORS enabled for frontend communication

**Dependencies:**
- `express` - Web server framework
- `mqtt` - MQTT client
- `socket.io` - Real-time bidirectional communication
- `pg` - PostgreSQL client
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management

**Available Scripts:**
```bash
npm run dev    # Run development server
npm start      # Start server
```

### 3. Frontend (`frontend/`)

**Tech Stack:**
- React with TypeScript
- Vite for fast builds
- Real-time data visualization

**Available Scripts:**
```bash
npm run dev    # Start development server
npm run build  # Build for production
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database
- MQTT Broker (e.g., Mosquitto)
- ESP32 development environment (Arduino IDE or PlatformIO)

### Backend Setup

```bash
cd backend
npm install

# Create .env file with your configuration
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parking_monitor
DB_USER=postgres
DB_PASSWORD=your_password
MQTT_BROKER=your_mqtt_broker_ip
MQTT_PORT=1883
MQTT_USER=mqtt_user
MQTT_PASSWORD=mqtt_password
PORT=3000
EOF

npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### ESP32 Setup

1. Install Arduino IDE or PlatformIO
2. Install ESP32 board support
3. Install required libraries:
   - WiFi (built-in)
   - PubSubClient
4. Update WiFi and MQTT credentials in `ESP32-MAIN.ino`
5. Upload to ESP32 board

## Usage

### Monitor Parking Spaces

1. Start the backend server
2. Start the frontend development server or access the deployed frontend
3. View real-time parking status on the dashboard
4. Monitor sensor readings and alerts

### MQTT Topics

The ESP32 sensors publish to the following MQTT topics:
- `parking/status/{node_id}` - Vehicle detection status
- `parking/alert/{node_id}` - Alert messages
- `parking/sensor/{node_id}` - Sensor readings (distance, etc.)

## Configuration

### Environment Variables (Backend)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parking_monitor
DB_USER=postgres
DB_PASSWORD=your_password

# MQTT
MQTT_BROKER=192.168.1.206
MQTT_PORT=1883
MQTT_USER=your_mqtt_user
MQTT_PASSWORD=your_mqtt_password

# Server
PORT=3000
NODE_ENV=development
```

### Sensor Configuration (ESP32)

Modify these constants in `ESP32-MAIN.ino`:

```cpp
const int DETECTION_DISTANCE = 50;    // cm - distance to detect vehicle
const int VIOLATION_TIME = 60000;     // ms - time before marking violation
const int SENSOR_READ_INTERVAL = 500; // ms - sensor polling interval
```

## API Endpoints

The backend provides RESTful API endpoints and WebSocket connections for real-time updates.

### WebSocket Events
- `parkingStatusUpdate` - Real-time parking space status
- `alertTriggered` - Alert notifications
- `sensorReading` - Raw sensor data

## Features

✅ Real-time vehicle detection using ultrasonic sensors  
✅ MQTT-based communication for low-latency updates  
✅ Web-based real-time dashboard  
✅ Multiple parking zone support  
✅ Alert system with buzzer and LED indicators  
✅ Historical data storage in PostgreSQL  
✅ RESTful API for integration  
✅ WebSocket support for real-time updates  

## Troubleshooting

### ESP32 Connection Issues
- Verify WiFi credentials are correct
- Check MQTT broker is accessible from ESP32
- Review serial output for connection errors

### Backend Connection Problems
- Ensure PostgreSQL is running
- Check MQTT broker connectivity
- Verify environment variables are set correctly

### Frontend Not Updating
- Check backend is running on the correct port
- Verify Socket.IO connection in browser console
- Clear browser cache

## Development

### Running All Services Locally

```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - ESP32 monitoring (optional)
# Use Arduino IDE serial monitor at 115200 baud
```

## Future Enhancements

- [ ] Mobile app for parking space search
- [ ] Payment integration
- [ ] Reservation system
- [ ] Analytics and reporting
- [ ] Multi-language support
- [ ] Advanced ML-based detection
- [ ] Energy optimization features

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

This project is open source and available under the MIT License.

## Authors

- **Zaidi** - Initial development and architecture

## Support

For issues, questions, or suggestions, please open an issue in the repository or contact the development team.

---

**Last Updated:** December 2025  
**Status:** Active Development
