#include <WiFi.h>
#include <PubSubClient.h>

// ========================================
// CONFIGURATION - CHANGE THESE VALUES
// ========================================
// WiFi credentials
const char* ssid = "DREAM INC 2.4_EXT";
const char* password = "Befayefo!3094?!";

// MQTT Broker
const char* mqtt_server = "192.168.1.206";  // Your server IP
const int mqtt_port = 1883;
const char* mqtt_user = "mojiz";
const char* mqtt_password = "1735";

// Node configuration

const char* node_id = "esp32_sensor_001";  // Unique ID for each node
const char* node_location = "Zone A-1";    // Physical location

// ========================================
// HARDWARE PIN CONFIGURATION
// ========================================
const int BUZZER_PIN = 25;        // Buzzer connected to GPIO 25
const int LED_GREEN = 26;         // Green LED - GPIO 26
const int LED_RED = 27;           // Red LED - GPIO 27
const int TRIG_PIN = 32;          // Ultrasonic sensor TRIG - GPIO 32
const int ECHO_PIN = 33;          // Ultrasonic sensor ECHO - GPIO 33

// ========================================
// DETECTION PARAMETERS
// ========================================
const int DETECTION_DISTANCE = 50;    // Distance in cm to detect vehicle
const int VIOLATION_TIME = 60000;     // 60 seconds - time before violation
const int BUZZER_FREQUENCY = 2000;    // Buzzer frequency in Hz
const int SENSOR_READ_INTERVAL = 500; // Read sensor every 500ms

// ========================================
// STATE VARIABLES
// ========================================
enum ParkingState {
  IDLE,
  VEHICLE_DETECTED,
  TIMER_RUNNING,
  VIOLATION
};

ParkingState currentState = IDLE;
unsigned long vehicleDetectedTime = 0;
unsigned long lastSensorRead = 0;
bool buzzerActive = false;
bool buzzerSilenced = false;

WiFiClient espClient;
PubSubClient client(espClient);

// ========================================
// SETUP WIFI
// ========================================
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi connection failed");
  }
}

// ========================================
// MQTT CALLBACK - HANDLE COMMANDS
// ========================================
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📩 Message received [");
  Serial.print(topic);
  Serial.print("]: ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  String topicStr = String(topic);
  
  // Handle SILENCE command
  if (topicStr.indexOf("/cmd/silence") > 0) {
    Serial.println("🔇 SILENCE command received");
    buzzerSilenced = true;
    stopBuzzer();
  }
  
  // Handle RESET command
  else if (topicStr.indexOf("/cmd/reset") > 0) {
    Serial.println("🔄 RESET command received");
    resetSystem();
  }
}

// ========================================
// MQTT RECONNECT
// ========================================
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(node_id, mqtt_user, mqtt_password)) {
      Serial.println("connected ✅");
      
      // Subscribe to command topics
      String cmdTopic = "node/" + String(node_id) + "/cmd/#";
      client.subscribe(cmdTopic.c_str());
      Serial.print("📡 Subscribed to: ");
      Serial.println(cmdTopic);
      
      // Publish online status
      publishStatus("online");
      
      // Publish node info
      publishNodeInfo();
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" - retrying in 5 seconds");
      delay(5000);
    }
  }
}

// ========================================
// PUBLISH FUNCTIONS
// ========================================
void publishStatus(const char* status) {
  String topic = "node/" + String(node_id) + "/status";
  client.publish(topic.c_str(), status);
  Serial.print("📤 Status: ");
  Serial.println(status);
}

void publishNodeInfo() {
  String topic = "node/" + String(node_id) + "/info";
  String info = "{\"type\":\"parking-sensor\",\"hasCam\":false,\"location\":\"" + String(node_location) + "\"}";
  client.publish(topic.c_str(), info.c_str());
  Serial.print("📤 Info: ");
  Serial.println(info);
}

void publishParkingState(const char* state) {
  String topic = "node/" + String(node_id) + "/parking_state";
  client.publish(topic.c_str(), state);
  Serial.print("📤 Parking State: ");
  Serial.println(state);
}

void publishAlert(const char* alertType) {
  String topic = "node/" + String(node_id) + "/alerts";
  client.publish(topic.c_str(), alertType);
  Serial.print("📤 Alert: ");
  Serial.println(alertType);
}

void publishDistance(int distance) {
  String topic = "node/" + String(node_id) + "/sensor/distance";
  String payload = String(distance);
  client.publish(topic.c_str(), payload.c_str());
}

// ========================================
// ULTRASONIC SENSOR - MEASURE DISTANCE
// ========================================
int getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  
  if (duration == 0) {
    return -1; // No echo received
  }
  
  int distance = duration * 0.034 / 2; // Calculate distance in cm
  return distance;
}

// ========================================
// LED CONTROL
// ========================================
void setLEDs(bool green, bool red) {
  digitalWrite(LED_GREEN, green ? HIGH : LOW);
  digitalWrite(LED_RED, red ? HIGH : LOW);
}

// ========================================
// BUZZER CONTROL (Updated for ESP32 Core 3.x)
// ========================================
void startBuzzer() {
  if (!buzzerSilenced && !buzzerActive) {
    ledcAttach(BUZZER_PIN, BUZZER_FREQUENCY, 8);
    ledcWrite(BUZZER_PIN, 128); // 50% duty cycle
    buzzerActive = true;
    Serial.println("🔊 Buzzer ON");
  }
}

void stopBuzzer() {
  if (buzzerActive) {
    ledcWrite(BUZZER_PIN, 0);
    ledcDetach(BUZZER_PIN);
    buzzerActive = false;
    Serial.println("🔇 Buzzer OFF");
  }
}

// ========================================
// SYSTEM RESET
// ========================================
void resetSystem() {
  currentState = IDLE;
  vehicleDetectedTime = 0;
  buzzerSilenced = false;
  stopBuzzer();
  setLEDs(true, false); // Green ON, Red OFF
  publishParkingState("idle");
  Serial.println("🔄 System RESET");
}

// ========================================
// STATE MACHINE - PARKING LOGIC
// ========================================
void updateParkingState() {
  unsigned long currentTime = millis();
  
  // Read sensor periodically
  if (currentTime - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = currentTime;
    
    int distance = getDistance();
    
    if (distance > 0 && distance < 400) { // Valid reading (up to 4 meters)
      publishDistance(distance);
      
      bool vehiclePresent = (distance < DETECTION_DISTANCE);
      
      // STATE MACHINE
      switch (currentState) {
        
        case IDLE:
          if (vehiclePresent) {
            currentState = VEHICLE_DETECTED;
            vehicleDetectedTime = currentTime;
            setLEDs(false, false); // Both OFF
            publishParkingState("vehicle_detected");
            Serial.println("🚗 Vehicle DETECTED");
          } else {
            setLEDs(true, false); // Green ON
          }
          break;
        
        case VEHICLE_DETECTED:
          if (!vehiclePresent) {
            // Vehicle left quickly
            resetSystem();
          } else if (currentTime - vehicleDetectedTime > 5000) {
            // Vehicle stayed for 5 seconds, start timer
            currentState = TIMER_RUNNING;
            publishParkingState("timer_running");
            Serial.println("⏱️ Timer STARTED");
          }
          break;
        
        case TIMER_RUNNING:
          if (!vehiclePresent) {
            // Vehicle left before violation
            resetSystem();
          } else if (currentTime - vehicleDetectedTime > VIOLATION_TIME) {
            // VIOLATION! Vehicle parked too long
            currentState = VIOLATION;
            setLEDs(false, true); // Red ON
            startBuzzer();
            publishParkingState("violation");
            publishAlert("violation");
            Serial.println("🚨 VIOLATION!");
          } else {
            // Still in timer, blink red LED
            int remaining = (VIOLATION_TIME - (currentTime - vehicleDetectedTime)) / 1000;
            if (remaining % 2 == 0) {
              setLEDs(false, true);
            } else {
              setLEDs(false, false);
            }
          }
          break;
        
        case VIOLATION:
          if (!vehiclePresent) {
            // Vehicle finally left
            stopBuzzer();
            resetSystem();
            Serial.println("✅ Vehicle LEFT after violation");
          } else {
            // Keep buzzer and red LED on
            setLEDs(false, true);
            if (!buzzerSilenced) {
              startBuzzer();
            }
          }
          break;
      }
    }
  }
}

// ========================================
// SETUP
// ========================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n🚗 IoT Parking Monitor - ESP32 Node");
  Serial.print("Node ID: ");
  Serial.println(node_id);
  
  // Setup pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Initial state - Green LED ON
  setLEDs(true, false);
  
  // Connect WiFi
  setup_wifi();
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  
  Serial.println("✅ Setup complete - Starting main loop");
}

// ========================================
// MAIN LOOP
// ========================================
void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Update parking state machine
  updateParkingState();
  
  // Small delay to prevent watchdog reset
  delay(10);
}