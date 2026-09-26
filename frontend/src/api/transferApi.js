import client from './axiosClient.js';
export const getTransfers = (params) => client.get('/transfers', { params });
