/**
 * api.js — thin fetch wrapper for the Placement Readiness Platform backend.
 * Token is kept in localStorage under 'prp_token' (this is a normal
 * server-rendered web app, not a sandboxed artifact, so browser
 * storage is the right place for a session token).
 */
const API_BASE = '/api';

const Api = {
  getToken() {
    return localStorage.getItem('prp_token');
  },
  setSession(token, user) {
    localStorage.setItem('prp_token', token);
    localStorage.setItem('prp_user', JSON.stringify(user));
  },
  getUser() {
    const raw = localStorage.getItem('prp_user');
    return raw ? JSON.parse(raw) : null;
  },
  logout() {
    localStorage.removeItem('prp_token');
    localStorage.removeItem('prp_user');
    window.location.href = '/pages/login.html';
  },
  requireAuth() {
    if (!this.getToken()) window.location.href = '/pages/login.html';
  },

  async request(path, { method = 'GET', body, isForm = false } = {}) {
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isForm && body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },

  // ---- Auth ----
  register(payload) { return this.request('/auth/register', { method: 'POST', body: payload }); },
  login(payload) { return this.request('/auth/login', { method: 'POST', body: payload }); },

  forgotPassword(payload) {
  return this.request('/auth/forgot-password', {
    method: 'POST',
    body: payload
  });
},

  resetPassword(payload) {
  return this.request('/auth/reset-password', {
    method: 'POST',
    body: payload
  });
},

  // ---- Roles ----
  getRoles() { return this.request('/roles'); },
  getRoleSkills(roleId) { return this.request(`/roles/${roleId}/skills`); },

  // ---- Resume ----
  uploadResume(formData) { return this.request('/resume/upload', { method: 'POST', body: formData, isForm: true }); },
  getLatestResume() { return this.request('/resume/latest'); },

  // ---- Assessment ----
  getAssessment(roleId) { return this.request(`/assessment/${roleId}`); },
  submitAssessment(roleId, payload) { return this.request(`/assessment/${roleId}/submit`, { method: 'POST', body: payload }); },

 // ---- Report ----
generateReport(payload) {
    return this.request('/report/generate', {
        method: 'POST',
        body: payload
    });
},

getReportHistory() {
    return this.request('/report/history');
},

// ---- Jobs ----
getRecommendedOpenings(roleId, limit = 50) {
    return this.request(
        `/jobs/recommended/${roleId}?limit=${limit}`
    );
},

};