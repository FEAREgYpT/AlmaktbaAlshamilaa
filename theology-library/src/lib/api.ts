import axios from 'axios';

const DEFAULT_BASE = 'http://127.0.0.1:3847/api';

export async function createApiClient() {
  const baseURL = (window as any).electronAPI
    ? await (window as any).electronAPI.getApiBaseUrl()
    : DEFAULT_BASE;

  return axios.create({ baseURL });
}
