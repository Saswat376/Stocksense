import client from './axiosClient.js';
export const getDeliveries = (params) => client.get('/deliveries', { params });
