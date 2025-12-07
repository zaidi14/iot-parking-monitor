import axios from "axios";

const API_BASE_URL = "http://localhost:3001/api";

export interface Node {
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
}

export const api = {
  async getNodes(): Promise<Node[]> {
    const response = await axios.get(API_BASE_URL + "/nodes");
    return response.data;
  },

  async silenceNode(nodeId: string): Promise<void> {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/silence");
  },

  async resetNode(nodeId: string): Promise<void> {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/reset");
  },

  async startVideo(nodeId: string): Promise<void> {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/video/start");
  },

  async stopVideo(nodeId: string): Promise<void> {
    await axios.post(API_BASE_URL + "/nodes/" + nodeId + "/video/stop");
  },
};
