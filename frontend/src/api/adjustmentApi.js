import client from './axiosClient.js';
export const getAdjustments = (params) => client.get('/adjustments', { params });
