import client from './axiosClient.js';
export const getProducts = (params) => client.get('/products', { params });
