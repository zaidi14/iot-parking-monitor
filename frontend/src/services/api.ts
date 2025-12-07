import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";

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

  deleteNode: async (nodeId: string): Promise<void> => {
    await axios.delete(API_BASE_URL + "/nodes/" + nodeId);
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
};
