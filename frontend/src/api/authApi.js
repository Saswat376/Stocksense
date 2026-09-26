import client from './axiosClient.js';

export const authApi = {
  login:          (data) => client.post('/auth/login', data),
  signup:         (data) => client.post('/auth/signup', data),
  forgotPassword: (data) => client.post('/auth/forgot-password', data),
  verifyOtp:      (data) => client.post('/auth/verify-otp', data),
  resetPassword:  (data) => client.post('/auth/reset-password', data),
  me:             ()     => client.get('/auth/me'),
};
