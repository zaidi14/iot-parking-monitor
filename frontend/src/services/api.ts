import axios from "axios";

const API_BASE_URL = "http://192.168.1.110:3000/api";

export type Node = {
  id: number;
  node_id: string;
  type: string;
  has_cam: boolean;
  location: string | null;
  last_status: string | null;
  last_parking_state: string | null;
  last_video_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ViolationLog = {
  id: number;
  node_id: string;
  violation_type: string;
  details: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

export const api = {
  getNodes: async (): Promise<Node[]> => {
    const response = await axios.get(API_BASE_URL + "/nodes");
    return response.data;
  },

  getViolationLogs: async (nodeId: string, limit = 50): Promise<ViolationLog[]> => {
    const response = await axios.get(API_BASE_URL + "/nodes/" + nodeId + "/violations", {
      params: { limit }
    });
    return response.data;
  },

  silenceNode: async (nodeId: string): Promise<void> => {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/silence");
  },

  resetNode: async (nodeId: string): Promise<void> => {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/reset");
  },

  startVideo: async (nodeId: string): Promise<void> => {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/video/start");
  },

  stopVideo: async (nodeId: string): Promise<void> => {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/video/stop");
  },
  
  startPhoneStream: async (nodeId: string): Promise<void> => {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/phone/start");
  },

  stopPhoneStream: async (nodeId: string): Promise<void> => {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/phone/stop");
  },

  // Parking violation endpoints
  sensorDetected: async (nodeId: string, threshold: number): Promise<any> => {
    const response = await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/sensor/detect", {
      threshold
    });
    return response.data;
  },

  vehicleDetected: async (nodeId: string, confidence: number, frameData?: string): Promise<any> => {
    const response = await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/vehicle/detect", {
      confidence,
      frameData
    });
    return response.data;
  },

  reportViolation: async (nodeId: string, videoUrl?: string, details?: string): Promise<any> => {
    const response = await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/violation/report", {
      videoUrl,
      details
    });
    return response.data;
  },

  resolveViolation: async (nodeId: string, violationId?: string): Promise<any> => {
    const response = await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/violation/resolve", {
      violationId
    });
    return response.data;
  },

  getParkingSession: async (nodeId: string): Promise<any> => {
    const response = await axios.get(API_BASE_URL + "/nodes/" + nodeId + "/parking/session");
    return response.data;
  },

  relayVideo: async (nodeId: string, videoUrl?: string): Promise<any> => {
    const response = await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/video/relay", {
      videoUrl
    });
    return response.data;
  }
};
