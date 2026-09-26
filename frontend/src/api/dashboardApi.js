import client from './axiosClient.js';
export const getDashboardKpis = (params) => client.get('/dashboard/kpis', { params });
