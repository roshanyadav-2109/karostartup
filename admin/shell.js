/* ============================================================
   ADMIN SHELL — shared layout renderer for all admin pages
   ============================================================ */

async function renderAdminShell(activeKey, breadcrumb) {
  const root = document.getElementById('admin-root');
  const profile = await getCurrentProfile();
  const admin = profile?.role === 'admin';
  const user = await getCurrentUser();

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', href: '/admin/' },
    { key: 'articles', label: 'Articles', href: '/admin/articles.html' },
    { key: 'categories', label: 'Categories', href: '/admin/categories.html' },
    { key: 'companies', label: 'Companies', href: '/admin/companies.html' },
    { key: 'funding', label: 'Funding', href: '/admin/funding.html' },
    { key: 'tickers', label: 'Tickers', href: '/admin/tickers.html' },
    { key: 'shorts', label: 'Shorts', href: '/admin/shorts.html' },
    { key: 'comments', label: 'Comments', href: '/admin/comments.html' },
    { key: 'submissions', label: 'Submissions', href: '/admin/submissions.html' },
    { key: 'newsletters', label: 'Newsletters', href: '/admin/newsletters.html', adminOnly: true },
    { key: 'users', label: 'Users', href: '/admin/users.html', adminOnly: true }
  ];

  root.innerHTML = `
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <a href="/" class="logo">Karostartup<span class="dot"></span></a>
      <div class="role-chip">${escapeHtml((profile?.role || 'staff').toUpperCase())}</div>
      <nav>
        ${navItems.filter(n => !n.adminOnly || admin).map(n => `
          <a href="${n.href}" class="${n.key === activeKey ? 'is-active' : ''}">${escapeHtml(n.label)}</a>
        `).join('')}
      </nav>
    </aside>
    <div class="admin-main">
      <div class="admin-bar">
        <div class="breadcrumb"><a href="/admin/">Admin</a> <span style="color:#e6e6e6;">›</span> <span class="cur">${escapeHtml(breadcrumb || activeKey)}</span></div>
        <div class="user-menu">
          <a href="/" target="_blank" rel="noopener">View site ↗</a>
          <span style="color:#0a0a0a;font-weight:600;">${escapeHtml(profile?.full_name || user?.email || 'You')}</span>
          <a href="#" id="admin-signout">Sign out</a>
        </div>
      </div>
      <div class="admin-content" id="admin-content"></div>
    </div>
  </div>`;

  document.getElementById('admin-signout').addEventListener('click', (e) => { e.preventDefault(); signOut(); });
}

window.renderAdminShell = renderAdminShell;
