import client from './axiosClient.js';
export const login = (credentials) => client.post('/auth/login', credentials);
export const signup = (details) => client.post('/auth/signup', details);
