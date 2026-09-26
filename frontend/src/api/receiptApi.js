import client from './axiosClient.js';
export const getReceipts = (params) => client.get('/receipts', { params });
