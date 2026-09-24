/* ==========================================================================
   WhatsApp Bot & Automation System - Dashboard Client App
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let ws = null;
  let currentStatus = { status: 'disconnected', qr: null, user: null, groups: [] };
  let schedules = [];
  let botRules = [];
  let contacts = [];
  let waGroups = [];
  let settings = {};

  // Tab Navigation
  const navLinks = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-content');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab');

      navLinks.forEach(n => n.classList.remove('active'));
      tabContents.forEach(t => t.classList.remove('active'));

      link.classList.add('active');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');

      // Update Page Titles
      updateHeaderTitle(targetTab);
    });
  });

  function updateHeaderTitle(tab) {
    const titleMap = {
      'overview': ['Ringkasan & Status WhatsApp', 'Pantau koneksi WhatsApp dan statistik otomatisasi'],
      'schedules': ['Pesan Terjadwal Harian', 'Kelola jadwal pengiriman pesan harian & mingguan'],
      'bot-rules': ['Aturan Bot Otomatis (Auto-Responder)', 'Atur respon pesan otomatis untuk kebutuhan internal'],
      'contacts': ['Kontak Internal & Grup WhatsApp', 'Daftar nomor kontak dan grup WhatsApp yang tersinkronisasi'],
      'broadcast': ['Kirim Broadcast Pesan Massal', 'Kirim pesan instan ke banyak penerima dengan jeda anti-ban'],
      'logs': ['Riwayat Log & Pengaturan Sistem', 'Pantau semua aktivitas pengiriman dan ubah preferensi sistem']
    };

    if (titleMap[tab]) {
      document.getElementById('page-title').textContent = titleMap[tab][0];
      document.getElementById('page-subtitle').textContent = titleMap[tab][1];
    }
  }

  // WebSocket Setup
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleWSMessage(payload);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed. Retrying in 3s...');
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  function handleWSMessage({ type, data }) {
    switch (type) {
      case 'initial_state':
        currentStatus = data.status || {};
        schedules = data.schedules || [];
        botRules = data.botRules || [];
        contacts = data.contacts || [];
        settings = data.settings || {};
        renderAll();
        renderLogsTable(data.logs || []);
        break;

      case 'status_change':
        currentStatus = { ...currentStatus, ...data };
        renderStatus();
        break;

      case 'qr':
        currentStatus.qr = data.qr;
        currentStatus.status = 'qr_ready';
        renderStatus();
        break;

      case 'schedules_updated':
        schedules = data;
        renderSchedules();
        updateBadges();
        break;

      case 'rules_updated':
        botRules = data;
        renderBotRules();
        updateBadges();
        break;

      case 'contacts_updated':
        contacts = data;
        renderContacts();
        break;

      case 'settings_updated':
        settings = data;
        renderSettings();
        break;

      case 'message_received':
        addActivityFeedItem('INBOUND', `Pesan masuk dari ${data.pushName}`, data.text);
        break;

      case 'broadcast_progress':
        updateBroadcastProgress(data);
        break;

      case 'logs_updated':
        renderLogsTable(data);
        break;

      default:
        break;
    }
  }

  function renderAll() {
    renderStatus();
    renderSchedules();
    renderBotRules();
    renderContacts();
    renderSettings();
    updateBadges();
    fetchGroups();
  }

  // Status & QR Code Renderer
  function renderStatus() {
    const statusPill = document.getElementById('global-status-pill');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    const statConnStatus = document.getElementById('stat-conn-status');
    const statConnUser = document.getElementById('stat-conn-user');

    const qrLoading = document.getElementById('qr-loading');
    const qrImage = document.getElementById('qr-image');
    const qrConnectedBox = document.getElementById('qr-connected-box');
    const btnLogout = document.getElementById('btn-logout-wa');

    statusDot.className = 'status-dot ' + currentStatus.status;

    if (currentStatus.status === 'connected') {
      statusText.textContent = 'Terhubung';
      statConnStatus.textContent = 'Terhubung';
      statConnUser.textContent = currentStatus.user?.name || currentStatus.user?.id || 'WhatsApp Web Active';

      qrLoading.classList.add('hidden');
      qrImage.classList.add('hidden');
      qrConnectedBox.classList.remove('hidden');
      btnLogout.classList.remove('hidden');

      if (currentStatus.user) {
        document.getElementById('connected-user-name').textContent = currentStatus.user.name || 'WhatsApp Account';
        document.getElementById('connected-user-jid').textContent = currentStatus.user.id || '';
      }
    } else if (currentStatus.status === 'qr_ready' && currentStatus.qr) {
      statusText.textContent = 'Scan QR Code';
      statConnStatus.textContent = 'Scan QR Code';
      statConnUser.textContent = 'Menunggu Pemindaian...';

      qrLoading.classList.add('hidden');
      qrConnectedBox.classList.add('hidden');
      btnLogout.classList.add('hidden');

      qrImage.src = currentStatus.qr;
      qrImage.classList.remove('hidden');
    } else {
      statusText.textContent = 'Terputus';
      statConnStatus.textContent = 'Terputus';
      statConnUser.textContent = 'Menghubungkan Ulang...';

      qrImage.classList.add('hidden');
      qrConnectedBox.classList.add('hidden');
      btnLogout.classList.add('hidden');
      qrLoading.classList.remove('hidden');
    }
  }

  function updateBadges() {
    const activeScheds = schedules.filter(s => s.active !== false).length;
    const activeRules = botRules.filter(r => r.active !== false).length;

    document.getElementById('schedule-count-badge').textContent = activeScheds;
    document.getElementById('rules-count-badge').textContent = activeRules;

    document.getElementById('stat-active-schedules').textContent = activeScheds;
    document.getElementById('stat-active-rules').textContent = activeRules;
  }

  // Fetch WhatsApp Groups
  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        waGroups = await res.json();
        renderGroupsList();
        populateTargetSelects();
      }
    } catch (e) {
      console.error('Failed to fetch groups:', e);
    }
  }

  function renderGroupsList() {
    const container = document.getElementById('wa-groups-list');
    if (!waGroups || waGroups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-users-slash"></i>
          <p>Belum ada grup terdeteksi atau WhatsApp belum terhubung.</p>
        </div>`;
      return;
    }

    container.innerHTML = waGroups.map(g => `
      <div class="activity-item">
        <div class="activity-icon emerald"><i class="fa-solid fa-users"></i></div>
        <div>
          <strong>${escapeHtml(g.subject)}</strong>
          <div class="text-muted" style="font-size:0.75rem">${g.id} • ${g.participantsCount || 0} Anggota</div>
        </div>
      </div>
    `).join('');
  }

  // Schedules Renderer
  function renderSchedules() {
    const container = document.getElementById('schedules-container');
    if (!schedules || schedules.length === 0) {
      container.innerHTML = `
        <div class="empty-state card" style="grid-column: 1 / -1">
          <i class="fa-solid fa-calendar-xmark"></i>
          <h3>Belum ada Pesan Terjadwal</h3>
          <p>Buat jadwal pesan harian untuk mengirim reminder atau laporan rutin secara otomatis.</p>
        </div>`;
      return;
    }

    container.innerHTML = schedules.map(s => {
      const isGroup = s.recipientType === 'group';
      const targetLabel = s.recipientName || s.recipientId;
      const daysText = s.days ? formatDays(s.days) : 'Setiap Hari';

      return `
        <div class="item-card">
          <div>
            <div class="item-card-header">
              <div class="item-title-box">
                <h3>${escapeHtml(s.title)}</h3>
                <div class="item-target">
                  <i class="fa-solid ${isGroup ? 'fa-people-group' : 'fa-user'}"></i>
                  ${escapeHtml(targetLabel)}
                </div>
              </div>
              <label class="checkbox-label" title="Aktifkan/Nonaktifkan">
                <input type="checkbox" class="toggle-schedule-active" data-id="${s.id}" ${s.active !== false ? 'checked' : ''}>
              </label>
            </div>

            <div class="item-body">${escapeHtml(s.message)}</div>
          </div>

          <div>
            <div class="item-meta">
              <div>
                <i class="fa-solid fa-clock text-emerald"></i> <strong>${s.time || '08:00'}</strong> (${daysText})
              </div>
              <div>${s.lastRun ? 'Terakhir: ' + formatDate(s.lastRun) : 'Belum Pernah'}</div>
            </div>

            <div class="item-actions mt-3">
              <button class="btn btn-sm btn-outline btn-run-now" data-id="${s.id}">
                <i class="fa-solid fa-play"></i> Kirim Sekarang
              </button>
              <button class="btn btn-sm btn-ghost btn-edit-sched" data-id="${s.id}">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-sm btn-ghost text-rose btn-delete-sched" data-id="${s.id}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach Event Listeners
    document.querySelectorAll('.toggle-schedule-active').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        await updateSchedule(id, { active: e.target.checked });
      });
    });

    document.querySelectorAll('.btn-run-now').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...`;
        try {
          const res = await fetch(`/api/schedules/${id}/run-now`, { method: 'POST' });
          const json = await res.json();
          if (res.ok) {
            showToast('Pesan berhasil dikirim sekarang!', 'success');
          } else {
            showToast(json.error || 'Gagal mengirim pesan', 'error');
          }
        } catch (err) {
          showToast('Terjadi kesalahan koneksi', 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-play"></i> Kirim Sekarang`;
        }
      });
    });

    document.querySelectorAll('.btn-edit-sched').forEach(btn => {
      btn.addEventListener('click', () => openScheduleModal(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.btn-delete-sched').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
          await deleteSchedule(id);
        }
      });
    });
  }

  // Bot Rules Renderer
  function renderBotRules() {
    const container = document.getElementById('rules-container');
    if (!botRules || botRules.length === 0) {
      container.innerHTML = `
        <div class="empty-state card" style="grid-column: 1 / -1">
          <i class="fa-solid fa-robot"></i>
          <h3>Belum ada Aturan Bot</h3>
          <p>Tambahkan aturan kata kunci untuk membuat bot otomatis membalas pertanyaan karyawan.</p>
        </div>`;
      return;
    }

    container.innerHTML = botRules.map(r => `
      <div class="item-card">
        <div>
          <div class="item-card-header">
            <div class="item-title-box">
              <h3>${escapeHtml(r.name)}</h3>
              <div class="item-target">
                <span class="badge badge-info">${r.matchType || 'contains'}</span>
                <strong>Trigger:</strong> "${escapeHtml(r.trigger)}"
              </div>
            </div>
            <label class="checkbox-label">
              <input type="checkbox" class="toggle-rule-active" data-id="${r.id}" ${r.active !== false ? 'checked' : ''}>
            </label>
          </div>

          <div class="item-body">${escapeHtml(r.response)}</div>
        </div>

        <div>
          <div class="item-meta">
            <div>Scope: <strong>${r.targetScope || 'all'}</strong></div>
            <div>Dibalas: <strong>${r.matchCount || 0}x</strong></div>
          </div>

          <div class="item-actions mt-3">
            <button class="btn btn-sm btn-ghost btn-edit-rule" data-id="${r.id}">
              <i class="fa-solid fa-pen-to-square"></i> Edit Aturan
            </button>
            <button class="btn btn-sm btn-ghost text-rose btn-delete-rule" data-id="${r.id}">
              <i class="fa-solid fa-trash"></i> Hapus
            </button>
          </div>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.toggle-rule-active').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        await updateRule(id, { active: e.target.checked });
      });
    });

    document.querySelectorAll('.btn-edit-rule').forEach(btn => {
      btn.addEventListener('click', () => openRuleModal(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.btn-delete-rule').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Hapus aturan bot ini?')) {
          await deleteRule(id);
        }
      });
    });
  }

  // Contacts Renderer
  function renderContacts() {
    const container = document.getElementById('contacts-list');
    const chipsContainer = document.getElementById('broadcast-recipient-chips');

    if (!contacts || contacts.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>Belum ada kontak tersimpan.</p></div>`;
      chipsContainer.innerHTML = `<span class="text-muted">Tidak ada kontak tersedia. Gunakan input manual.</span>`;
      return;
    }

    container.innerHTML = contacts.map(c => `
      <div class="activity-item" style="justify-content: space-between">
        <div>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="text-muted" style="font-size:0.75rem">${c.phone} ${c.notes ? '• ' + c.notes : ''}</div>
        </div>
        <button class="btn btn-sm btn-ghost text-rose btn-delete-contact" data-id="${c.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');

    chipsContainer.innerHTML = contacts.map(c => `
      <label class="tag-insert" style="display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;">
        <input type="checkbox" value="${c.phone}" class="broadcast-contact-cb" checked>
        ${escapeHtml(c.name)} (${c.phone})
      </label>
    `).join('');

    document.querySelectorAll('.btn-delete-contact').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Hapus kontak ini?')) {
          await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
          showToast('Kontak dihapus', 'info');
        }
      });
    });
  }

  // Settings Renderer
  function renderSettings() {
    if (settings.companyName) {
      document.getElementById('setting-company-name').value = settings.companyName;
      document.getElementById('sidebar-company-name').textContent = settings.companyName;
    }
    if (settings.broadcastDelaySec) {
      document.getElementById('setting-delay').value = settings.broadcastDelaySec;
    }
    document.getElementById('setting-autoreply').checked = settings.autoReplyEnabled !== false;
    document.getElementById('setting-scheduled').checked = settings.scheduledMsgEnabled !== false;
  }

  // Logs Table Renderer
  function renderLogsTable(logs) {
    const tbody = document.getElementById('logs-table-body');
    const feed = document.getElementById('recent-activity-feed');

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada data log.</td></tr>`;
      feed.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>Belum ada aktivitas.</p></div>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>${formatDate(l.timestamp)}</td>
        <td><span class="badge badge-info">${l.type}</span></td>
        <td>${escapeHtml(l.recipient || l.trigger || '-')}</td>
        <td style="max-width:300px; word-break:break-all;">${escapeHtml(l.message || l.response || l.error || '-')}</td>
        <td>
          <span class="badge ${l.status === 'success' ? 'badge-success' : 'badge-danger'}">
            ${l.status || 'failed'}
          </span>
        </td>
      </tr>
    `).join('');

    // Activity Feed (Top 5)
    feed.innerHTML = logs.slice(0, 6).map(l => `
      <div class="activity-item">
        <div class="activity-icon ${l.status === 'success' ? 'emerald' : 'purple'}">
          <i class="fa-solid ${l.type.includes('BOT') ? 'fa-robot' : 'fa-paper-plane'}"></i>
        </div>
        <div style="flex:1">
          <div style="display:flex; justify-content:space-between">
            <strong>${l.type}</strong>
            <span class="text-muted" style="font-size:0.75rem">${formatTime(l.timestamp)}</span>
          </div>
          <div style="font-size:0.8rem" class="text-muted">${escapeHtml(l.message || l.response || l.trigger || '')}</div>
        </div>
      </div>
    `).join('');
  }

  // Populate Select Dropdowns
  function populateTargetSelects() {
    const select = document.getElementById('sched-target-select');
    const recipientType = document.getElementById('sched-recipient-type').value;

    select.innerHTML = '';

    if (recipientType === 'group') {
      if (waGroups.length === 0) {
        select.innerHTML = `<option value="">-- Tidak ada grup WA --</option>`;
      } else {
        waGroups.forEach(g => {
          select.innerHTML += `<option value="${g.id}">${escapeHtml(g.subject)} (${g.participantsCount} Member)</option>`;
        });
      }
    } else {
      if (contacts.length === 0) {
        select.innerHTML = `<option value="">-- Belum ada kontak --</option>`;
      } else {
        contacts.forEach(c => {
          select.innerHTML += `<option value="${c.phone}">${escapeHtml(c.name)} (${c.phone})</option>`;
        });
      }
    }
  }

  document.getElementById('sched-recipient-type').addEventListener('change', populateTargetSelects);

  // Dynamic Variable Insertion
  document.querySelectorAll('.tag-insert').forEach(tag => {
    tag.addEventListener('click', () => {
      const text = tag.getAttribute('data-var');
      const textarea = document.getElementById('sched-message');
      textarea.value += ' ' + text;
    });
  });

  document.querySelectorAll('.tag-insert-rule').forEach(tag => {
    tag.addEventListener('click', () => {
      const text = tag.getAttribute('data-var');
      const textarea = document.getElementById('rule-response');
      textarea.value += ' ' + text;
    });
  });

  // Modal Triggers
  const modalSchedule = document.getElementById('modal-schedule');
  const modalRule = document.getElementById('modal-rule');
  const modalContact = document.getElementById('modal-contact');

  document.getElementById('btn-add-schedule').addEventListener('click', () => openScheduleModal());
  document.getElementById('btn-close-schedule-modal').addEventListener('click', () => modalSchedule.classList.add('hidden'));
  document.getElementById('btn-cancel-schedule').addEventListener('click', () => modalSchedule.classList.add('hidden'));

  document.getElementById('btn-add-rule').addEventListener('click', () => openRuleModal());
  document.getElementById('btn-close-rule-modal').addEventListener('click', () => modalRule.classList.add('hidden'));
  document.getElementById('btn-cancel-rule').addEventListener('click', () => modalRule.classList.add('hidden'));

  document.getElementById('btn-add-contact').addEventListener('click', () => modalContact.classList.remove('hidden'));
  document.getElementById('btn-close-contact-modal').addEventListener('click', () => modalContact.classList.add('hidden'));
  document.getElementById('btn-cancel-contact').addEventListener('click', () => modalContact.classList.add('hidden'));

  function openScheduleModal(id = null) {
    populateTargetSelects();
    if (id) {
      const sched = schedules.find(s => s.id === id);
      if (sched) {
        document.getElementById('modal-schedule-title').textContent = 'Edit Pesan Terjadwal';
        document.getElementById('schedule-id').value = sched.id;
        document.getElementById('sched-title').value = sched.title;
        document.getElementById('sched-recipient-type').value = sched.recipientType || 'group';
        populateTargetSelects();
        document.getElementById('sched-target-select').value = sched.recipientId;
        document.getElementById('sched-time').value = sched.time || '08:00';
        document.getElementById('sched-message').value = sched.message;
      }
    } else {
      document.getElementById('modal-schedule-title').textContent = 'Buat Pesan Terjadwal Baru';
      document.getElementById('form-schedule').reset();
      document.getElementById('schedule-id').value = '';
    }
    modalSchedule.classList.remove('hidden');
  }

  function openRuleModal(id = null) {
    if (id) {
      const rule = botRules.find(r => r.id === id);
      if (rule) {
        document.getElementById('modal-rule-title').textContent = 'Edit Aturan Bot';
        document.getElementById('rule-id').value = rule.id;
        document.getElementById('rule-name').value = rule.name;
        document.getElementById('rule-trigger').value = rule.trigger;
        document.getElementById('rule-match-type').value = rule.matchType || 'contains';
        document.getElementById('rule-target-scope').value = rule.targetScope || 'all';
        document.getElementById('rule-response').value = rule.response;
      }
    } else {
      document.getElementById('modal-rule-title').textContent = 'Tambah Aturan Bot Otomatis';
      document.getElementById('form-rule').reset();
      document.getElementById('rule-id').value = '';
    }
    modalRule.classList.remove('hidden');
  }

  // Form Submissions
  document.getElementById('form-schedule').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('schedule-id').value;
    const targetSelect = document.getElementById('sched-target-select');
    const selectedOptionText = targetSelect.options[targetSelect.selectedIndex]?.text || '';

    const payload = {
      title: document.getElementById('sched-title').value,
      recipientType: document.getElementById('sched-recipient-type').value,
      recipientId: targetSelect.value,
      recipientName: selectedOptionText,
      time: document.getElementById('sched-time').value,
      recurrence: document.getElementById('sched-recurrence').value,
      message: document.getElementById('sched-message').value,
      active: true
    };

    const url = id ? `/api/schedules/${id}` : '/api/schedules';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(id ? 'Jadwal berhasil diperbarui' : 'Jadwal baru berhasil dibuat', 'success');
        modalSchedule.classList.add('hidden');
      } else {
        const json = await res.json();
        showToast(json.error || 'Gagal menyimpan jadwal', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  });

  document.getElementById('form-rule').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rule-id').value;
    const payload = {
      name: document.getElementById('rule-name').value,
      trigger: document.getElementById('rule-trigger').value,
      matchType: document.getElementById('rule-match-type').value,
      targetScope: document.getElementById('rule-target-scope').value,
      response: document.getElementById('rule-response').value,
      active: true
    };

    const url = id ? `/api/bot-rules/${id}` : '/api/bot-rules';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Aturan bot berhasil disimpan', 'success');
        modalRule.classList.add('hidden');
      } else {
        showToast('Gagal menyimpan aturan', 'error');
      }
    } catch (err) {
      showToast('Kesalahan jaringan', 'error');
    }
  });

  document.getElementById('form-contact').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('contact-name').value,
      phone: document.getElementById('contact-phone').value,
      notes: document.getElementById('contact-notes').value
    };

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Kontak baru berhasil ditambah', 'success');
        modalContact.classList.add('hidden');
        document.getElementById('form-contact').reset();
      }
    } catch (err) {
      showToast('Gagal menambah kontak', 'error');
    }
  });

  // Broadcast Form
  document.getElementById('form-broadcast').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('broadcast-message-text').value;

    const checkedBoxes = document.querySelectorAll('.broadcast-contact-cb:checked');
    let recipients = Array.from(checkedBoxes).map(cb => cb.value);

    const manual = document.getElementById('manual-recipients-input').value;
    if (manual) {
      const parts = manual.split(',').map(s => s.trim()).filter(Boolean);
      recipients = [...recipients, ...parts];
    }

    recipients = [...new Set(recipients)];

    if (recipients.length === 0) {
      return showToast('Pilih atau masukkan setidaknya 1 penerima!', 'error');
    }
    if (!message.trim()) {
      return showToast('Isi pesan broadcast tidak boleh kosong!', 'error');
    }

    document.getElementById('broadcast-progress-container').classList.remove('hidden');

    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message })
      });
      const json = await res.json();
      if (res.ok) {
        showToast(json.message, 'success');
      } else {
        showToast(json.error || 'Gagal memulai broadcast', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  });

  function updateBroadcastProgress(data) {
    const percent = Math.round((data.current / data.total) * 100);
    document.getElementById('broadcast-progress-fill').style.width = percent + '%';
    document.getElementById('broadcast-progress-percent').textContent = percent + '%';
    document.getElementById('broadcast-progress-status').textContent = `Mengirim ${data.current} dari ${data.total} (${data.successCount} Sukses, ${data.failCount} Gagal)...`;

    if (data.current === data.total) {
      setTimeout(() => {
        showToast(`Broadcast Selesai! (${data.successCount} berhasil sent)`, 'success');
      }, 500);
    }
  }

  // Logout WA
  document.getElementById('btn-logout-wa').addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin melepaskan koneksi WhatsApp ini?')) {
      await fetch('/api/logout', { method: 'POST' });
      showToast('WhatsApp Logged out', 'info');
    }
  });

  // Action Buttons
  document.getElementById('btn-sync-groups').addEventListener('click', () => {
    fetchGroups();
    showToast('Sinkronisasi grup WhatsApp...', 'info');
  });

  document.getElementById('btn-resync-groups').addEventListener('click', fetchGroups);

  document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      companyName: document.getElementById('setting-company-name').value,
      broadcastDelaySec: parseInt(document.getElementById('setting-delay').value),
      autoReplyEnabled: document.getElementById('setting-autoreply').checked,
      scheduledMsgEnabled: document.getElementById('setting-scheduled').checked
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Pengaturan berhasil disimpan!', 'success');
      }
    } catch (err) {
      showToast('Gagal menyimpan pengaturan', 'error');
    }
  });

  // Toast System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
      success: 'fa-circle-check text-emerald',
      error: 'fa-circle-xmark text-rose',
      info: 'fa-circle-info text-blue'
    };

    toast.innerHTML = `
      <i class="fa-solid ${iconMap[type] || 'fa-circle-info'}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // Helper Utilities
  async function updateSchedule(id, fields) {
    await fetch(`/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
  }

  async function deleteSchedule(id) {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    showToast('Jadwal dihapus', 'info');
  }

  async function updateRule(id, fields) {
    await fetch(`/api/bot-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
  }

  async function deleteRule(id) {
    await fetch(`/api/bot-rules/${id}`, { method: 'DELETE' });
    showToast('Aturan bot dihapus', 'info');
  }

  function formatDays(days) {
    const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return days.map(d => names[d]).join(', ');
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start App
  initWebSocket();
});
