import client from './axiosClient.js';
export const getWarehouses = () => client.get('/warehouses');
