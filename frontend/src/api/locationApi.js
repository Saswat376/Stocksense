import client from './axiosClient.js';
export const updateLocation = (id, data) => client.put(`/locations/${id}`, data);
