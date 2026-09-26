import client from './axiosClient.js';
export const getStock = (params) => client.get('/stock', { params });
