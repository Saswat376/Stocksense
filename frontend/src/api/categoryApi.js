import client from './axiosClient.js';
export const getCategories = () => client.get('/categories');
