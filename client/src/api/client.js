import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const jobsApi = {
  list: (params) => api.get('/jobs', { params }).then(r => r.data),
  get: (id) => api.get(`/jobs/${id}`).then(r => r.data),
  create: (data) => api.post('/jobs', data).then(r => r.data),
  update: (id, data) => api.patch(`/jobs/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/jobs/${id}`).then(r => r.data),
  importCsv: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/jobs/import/csv', form).then(r => r.data);
  },
};

export const gmailApi = {
  status: () => api.get('/gmail/status').then(r => r.data),
  authUrl: () => api.get('/gmail/auth-url').then(r => r.data),
  sync: () => api.post('/gmail/sync').then(r => r.data),
  disconnect: () => api.post('/gmail/disconnect').then(r => r.data),
  history: () => api.get('/gmail/sync-history').then(r => r.data),
  confirm: (jobId, status) => api.post(`/gmail/confirm/${jobId}`, { status }).then(r => r.data),
  reparseTitles: () => api.post('/gmail/reparse-titles').then(r => r.data),
  clearImports: (onlyUnknown) => api.post('/gmail/clear-imports', { onlyUnknown }).then(r => r.data),
};

export const statsApi = {
  get: () => api.get('/stats').then(r => r.data),
};
