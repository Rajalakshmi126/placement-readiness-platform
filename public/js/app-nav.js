/**
 * app-nav.js — include on every authenticated page after api.js.
 * Guards the page, fills #nav-username if present, wires #logout-link.
 */
Api.requireAuth();

document.addEventListener('DOMContentLoaded', () => {
  const user = Api.getUser();
  const nameEl = document.getElementById('nav-username');
  if (nameEl && user) nameEl.textContent = user.name.split(' ')[0];

  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      Api.logout();
    });
  }
});
