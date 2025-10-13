import axios from 'axios';
import Constants from 'expo-constants';

const baseURL =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  Constants.expoConfig?.hostUri?.replace(/(:\d+)?$/, ':4000/api') ||
  'http://localhost:4000/api';

export const api = axios.create({
  baseURL,
  timeout: 15000
});

export const setAuthToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
