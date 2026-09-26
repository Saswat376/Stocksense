import client from './axiosClient.js';
export const getMoves = (params) => client.get('/moves', { params });
