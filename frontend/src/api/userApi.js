import client from './axiosClient.js';
export const getProfile = () => client.get('/users/me');
