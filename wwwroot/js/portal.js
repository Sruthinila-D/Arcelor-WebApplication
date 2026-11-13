// ArcelorMittal Pipe Traceability Portal - Main Application Logic
let currentTab = 'dashboard';
let currentRoleForMatrix = 'Engineer';

// Date Filter States (Coordinated with current calendar 2026)
let dashboardDateState = {
  startDate: '2026-11-01',
  endDate: '2026-11-15',
  label: 'Nov 01, 2026 - Nov 15, 2026'
};

let auditsDateState = {
  startDate: '2026-11-01',
  endDate: '2026-11-15',
  label: 'Nov 01, 2026 - Nov 15, 2026'
};

// State management
let usersState = { page: 1, pageSize: 5, search: '', status: 'All', role: 'All', total: 0, totalPages: 1 };
let auditsState = { page: 1, pageSize: 5, search: '', total: 0, totalPages: 1 };
let currentPermissions = null;
let dashboardDataCache = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupNavigation();
  loadDashboard();
});

// Authentication Guard
async function checkAuth() {
  const sessionStr = localStorage.getItem('user_session');
  let localUser = null;
  if (sessionStr) {
    try {
      localUser = JSON.parse(sessionStr);
    } catch (e) {
      console.warn('Invalid local user session');
    }
  }

  // Update UI immediately from local session if available
  if (localUser) {
    const nameEl = document.getElementById('currentUserName');
    if (nameEl) nameEl.textContent = localUser.name || localUser.username || 'Admin User';
    const roleEl = document.getElementById('currentUserRole');
    if (roleEl) roleEl.textContent = localUser.role || 'Administrator';
    const avatarEl = document.querySelector('.user-avatar-circle');
    if (avatarEl) avatarEl.textContent = localUser.initials || 'AD';
  }

  try {
    const res = await fetch('/api/auth/current');
    if (res.ok) {
      const data = await res.json();
      if (!data.isAuthenticated && !localUser) {
        window.location.href = '/login.html';
        return;
      }
      if (data.isAuthenticated && !localUser) {
        localStorage.setItem('user_session', JSON.stringify({
          name: data.name || data.username || 'Admin User',
          role: data.role || 'Administrator',
          initials: data.initials || 'AD'
        }));
      }
    } else if (!localUser) {
      window.location.href = '/login.html';
      return;
    }
  } catch (err) {
    console.warn('Auth check fallback:', err);
    if (!localUser) {
      window.location.href = '/login.html';
    }
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {}
  localStorage.removeItem('user_session');
  window.location.href = '/login.html';
}

// Navigation Handler
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.target;
      switchView(target);
    });
  });
}

function switchView(tabName, optionalParam = null) {
  currentTab = tabName;

  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    const target = item.dataset.target;
    if (target === tabName || (tabName === 'permissions' && target === 'roles')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide all screens
  document.querySelectorAll('.view-screen').forEach(screen => {
    screen.style.display = 'none';
  });

  // Show target screen
  const targetScreen = document.getElementById(`view-${tabName}`);
  if (targetScreen) {
    targetScreen.style.display = 'flex';
  }

  // Load screen data
  if (tabName === 'dashboard') {
    loadDashboard();
  } else if (tabName === 'users') {
    loadUsers();
  } else if (tabName === 'roles') {
    loadRoles();
  } else if (tabName === 'permissions') {
    if (optionalParam) currentRoleForMatrix = optionalParam;
    loadPermissionMatrix(currentRoleForMatrix);
  } else if (tabName === 'settings') {
    loadSettings();
  } else if (tabName === 'audits') {
    loadAudits();
  }
}

// UI Notification Toast
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastNotice');
  const text = document.getElementById('toastText');
  text.textContent = message;
  toast.className = `toast-notice show ${type}`;
  setTimeout(() => {
    toast.className = 'toast-notice';
  }, 3200);
}

// ==========================================
// DATE PICKER LOGIC (DASHBOARD & AUDITS)
// ==========================================
function toggleDatePopover(view) {
  const popover = document.getElementById(`${view}DatePopover`);
  if (!popover) return;
  const isShown = popover.classList.contains('show');
  
  // Close any other open popovers
  document.querySelectorAll('.date-picker-popover').forEach(p => p.classList.remove('show'));

  if (!isShown) {
    popover.classList.add('show');
  }
}

function applyDatePreset(view, start, end, label, btn) {
  // Update active chips in this popover
  const popover = document.getElementById(`${view}DatePopover`);
  popover.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const startInput = document.getElementById(view === 'dashboard' ? 'dashStartInput' : 'auditStartInput');
  const endInput = document.getElementById(view === 'dashboard' ? 'dashEndInput' : 'auditEndInput');
  
  startInput.value = start;
  endInput.value = end;

  if (view === 'dashboard') {
    dashboardDateState.startDate = start;
    dashboardDateState.endDate = end;
    dashboardDateState.label = label;
    document.getElementById('dashboardDateLabel').textContent = label;
    loadDashboard();
  } else {
    auditsDateState.startDate = start;
    auditsDateState.endDate = end;
    auditsDateState.label = label;
    document.getElementById('auditsDateLabel').textContent = label;
    auditsState.page = 1;
    loadAudits();
  }

  popover.classList.remove('show');
  showToast(`Date filter applied: ${label}`);
}

function applyCustomDateFilter(view) {
  const startInput = document.getElementById(view === 'dashboard' ? 'dashStartInput' : 'auditStartInput');
  const endInput = document.getElementById(view === 'dashboard' ? 'dashEndInput' : 'auditEndInput');
  const popover = document.getElementById(`${view}DatePopover`);

  const start = startInput.value;
  const end = endInput.value;

  if (start && end && start > end) {
    alert('Start date cannot be after End date.');
    return;
  }

  const formatFriendly = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  let label = 'Custom Range';
  if (start && end) {
    label = `${formatFriendly(start)} - ${formatFriendly(end)}`;
  } else if (start) {
    label = `From ${formatFriendly(start)}`;
  } else if (end) {
    label = `Until ${formatFriendly(end)}`;
  } else {
    label = 'All Dates';
  }

  if (view === 'dashboard') {
    dashboardDateState.startDate = start;
    dashboardDateState.endDate = end;
    dashboardDateState.label = label;
    document.getElementById('dashboardDateLabel').textContent = label;
    loadDashboard();
  } else {
    auditsDateState.startDate = start;
    auditsDateState.endDate = end;
    auditsDateState.label = label;
    document.getElementById('auditsDateLabel').textContent = label;
    auditsState.page = 1;
    loadAudits();
  }

  popover.classList.remove('show');
  showToast(`Date filter applied: ${label}`);
}

function resetDateFilter(view) {
  applyDatePreset(view, '2026-11-01', '2026-11-15', 'Nov 01, 2026 - Nov 15, 2026', null);
}

// ==========================================
// SCREEN 1: ADMIN DASHBOARD
// ==========================================
async function loadDashboard() {
  const { startDate, endDate } = dashboardDateState;
  const url = `/api/dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    dashboardDataCache = data;

    // Stat cards
    document.getElementById('kpiTotalPipes').textContent = Number(data.totalPipes).toLocaleString();
    document.getElementById('kpiAvailable').textContent = Number(data.available).toLocaleString();
    document.getElementById('kpiInTransit').textContent = Number(data.inTransit).toLocaleString();
    document.getElementById('kpiInspections').textContent = Number(data.inspections).toLocaleString();
    document.getElementById('kpiPassed').textContent = Number(data.passed).toLocaleString();
    document.getElementById('kpiRejected').textContent = Number(data.rejected).toLocaleString();
    document.getElementById('kpiUsers').textContent = Number(data.users).toLocaleString();
    document.getElementById('kpiRoles').textContent = Number(data.roles).toLocaleString();

    // Render Visualizations
    renderDonutChart(data.stockDistribution, data.totalPipes);
    renderTrendChart(data.inspectionTrends, document.getElementById('trendMetricSelect').value);
    renderGradeBarChart();
    renderYardBays();
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

function renderDonutChart(distribution, total) {
  const container = document.getElementById('donutSvgWrap');
  if (!container) return;

  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  let circlesHtml = '';

  distribution.forEach(item => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += (item.percentage / 100) * circumference;

    circlesHtml += `
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" 
              fill="transparent" 
              stroke="${item.color}" 
              stroke-width="${strokeWidth}" 
              stroke-dasharray="${strokeDasharray}" 
              stroke-dashoffset="${strokeDashoffset}" 
              stroke-linecap="butt"
              style="transition: stroke-width 0.2s; cursor: pointer;">
        <title>${item.label}: ${item.count.toLocaleString()} (${item.percentage}%)</title>
      </circle>
    `;
  });

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#F1F5F9" stroke-width="${strokeWidth}" />
      ${circlesHtml}
    </svg>
    <div class="donut-center-text">
      <div class="donut-center-count">${Number(total).toLocaleString()}</div>
      <div class="donut-center-sub">Pipes</div>
    </div>
  `;

  // Render Legend
  const legendWrap = document.getElementById('donutLegendList');
  if (legendWrap) {
    legendWrap.innerHTML = distribution.map(item => `
      <div class="donut-legend-item">
        <div class="donut-legend-dot-label">
          <span class="donut-color-dot" style="background-color: ${item.color};"></span>
          <span>${item.label}</span>
        </div>
        <span class="donut-legend-pct">${item.percentage}%</span>
      </div>
    `).join('');
  }
}

function selectTrendMetric(metric) {
  const select = document.getElementById('trendMetricSelect');
  if (select) {
    select.value = metric;
    handleTrendMetricChange();
  }
}

function renderTrendChart(trends, metricKey = 'Inspections') {
  const svg = document.getElementById('trendChartSvg');
  if (!svg || !trends || trends.length === 0) return;

  // Determine dynamic metric parameters for exact scaling and visual unification
  let themeColor, lightBg, borderBadge, unitLabel, maxVal, yTicks;

  if (metricKey === 'Rejected') {
    themeColor = '#E02424'; // Red matching Rejected KPI tile
    lightBg = '#FDE8E8';
    borderBadge = '#F8B4B4';
    unitLabel = 'Rejected Defect Count';
    maxVal = 35; // Dynamically scaled to fit 28 with headroom
    yTicks = [0, 7, 14, 21, 28, 35]; // Exact integer steps landing on 28
  } else if (metricKey === 'Passed') {
    themeColor = '#0E9F6E'; // Green matching Passed KPI tile
    lightBg = '#DEF7EC';
    borderBadge = '#BCF0DA';
    unitLabel = 'Conforming Pipe Count';
    maxVal = 1200;
    yTicks = [0, 300, 600, 900, 1200];
  } else {
    themeColor = '#F15A24'; // ArcelorMittal Orange matching Inspections KPI tile
    lightBg = '#FFF4ED';
    borderBadge = '#FFD8BE';
    unitLabel = 'Total Inspected Volume';
    maxVal = 1400;
    yTicks = [0, 350, 700, 1050, 1400];
  }

  // 1. Unify KPI tiles with active outline when metric is selected
  const kpiCards = {
    'Inspections': document.getElementById('kpiCardInspections'),
    'Passed': document.getElementById('kpiCardPassed'),
    'Rejected': document.getElementById('kpiCardRejected')
  };
  Object.keys(kpiCards).forEach(key => {
    const el = kpiCards[key];
    if (el) {
      if (key === metricKey) {
        el.style.border = `2px solid ${themeColor}`;
        el.style.boxShadow = `0 4px 14px ${metricKey === 'Rejected' ? 'rgba(224, 36, 36, 0.22)' : (metricKey === 'Passed' ? 'rgba(14, 159, 110, 0.22)' : 'rgba(241, 90, 36, 0.22)')}`;
        el.style.transform = 'translateY(-2px)';
      } else {
        el.style.border = '1px solid #E2E8F0';
        el.style.boxShadow = 'none';
        el.style.transform = 'none';
      }
    }
  });

  // 2. Unify header badge with current total
  const badge = document.getElementById('trendMetricBadge');
  if (badge && trends.length > 0) {
    const latestPoint = trends[trends.length - 1];
    const currentVal = metricKey === 'Passed' ? latestPoint.passed : (metricKey === 'Rejected' ? latestPoint.rejected : latestPoint.inspections);
    let badgeText = '';
    if (metricKey === 'Rejected') {
      badgeText = `Latest: ${currentVal} Rejected (Aligned with Tile)`;
    } else if (metricKey === 'Passed') {
      badgeText = `Latest: ${Number(currentVal).toLocaleString()} Passed Pipes`;
    } else {
      badgeText = `Latest: ${Number(currentVal).toLocaleString()} Total Inspected`;
    }
    badge.innerHTML = `
      <span style="display:inline-flex; align-items:center; gap:6px; background:${lightBg}; color:${themeColor}; border:1px solid ${borderBadge}; padding:3px 10px; border-radius:6px; font-weight:700; font-size:11.5px;">
        <span style="width:7px; height:7px; border-radius:50%; background:${themeColor}; display:inline-block;"></span>
        ${badgeText}
      </span>
    `;
  }

  // 3. SVG Dimensions & coordinate calculations
  const width = 560;
  const height = 240;
  const padding = { top: 32, right: 36, bottom: 48, left: 56 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = trends.map((t, idx) => {
    const val = metricKey === 'Passed' ? t.passed : (metricKey === 'Rejected' ? t.rejected : t.inspections);
    const denom = trends.length > 1 ? trends.length - 1 : 1;
    const x = padding.left + (idx / denom) * chartW;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    return { x, y, val, label: t.dateLabel };
  });

  // Smooth bezier curve
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  // 4. Specified Y-Axis (Line, Arrow, Title, Ticks, Gridlines)
  const yAxisLine = `
    <line x1="${padding.left}" y1="${padding.top - 8}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="#64748B" stroke-width="1.6" />
    <polygon points="${padding.left - 4},${padding.top - 6} ${padding.left + 4},${padding.top - 6} ${padding.left},${padding.top - 14}" fill="#64748B" />
    <text x="${padding.left - 6}" y="${padding.top - 18}" fill="#475569" font-size="10.5" font-weight="700" text-anchor="start">▲ ${unitLabel}</text>
  `;

  let gridHtml = '';
  yTicks.forEach(tick => {
    const yPos = padding.top + chartH - (tick / maxVal) * chartH;
    gridHtml += `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3" />
      <line x1="${padding.left - 5}" y1="${yPos}" x2="${padding.left}" y2="${yPos}" stroke="#64748B" stroke-width="1.4" />
      <text x="${padding.left - 9}" y="${yPos + 4}" fill="#64748B" font-size="10.5" font-weight="600" text-anchor="end">${tick === 0 ? '0' : tick.toLocaleString()}</text>
    `;
  });

  // 5. Specified X-Axis (Line, Arrow, Title, Ticks, Dates)
  const xAxisLine = `
    <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right + 12}" y2="${padding.top + chartH}" stroke="#64748B" stroke-width="1.6" />
    <polygon points="${width - padding.right + 10},${padding.top + chartH - 4} ${width - padding.right + 10},${padding.top + chartH + 4} ${width - padding.right + 17},${padding.top + chartH}" fill="#64748B" />
    <text x="${width - padding.right + 12}" y="${height - 8}" fill="#475569" font-size="10" font-weight="700" text-anchor="end">Inspection Date (2026) ▶</text>
  `;

  let xLabelsHtml = '';
  points.forEach((p, idx) => {
    xLabelsHtml += `
      <line x1="${p.x}" y1="${padding.top + chartH}" x2="${p.x}" y2="${padding.top + chartH + 5}" stroke="#64748B" stroke-width="1.2" />
    `;
    if (points.length <= 10 || idx % 2 === 0 || idx === points.length - 1) {
      xLabelsHtml += `
        <text x="${p.x}" y="${padding.top + chartH + 19}" fill="#64748B" font-size="10.5" font-weight="600" text-anchor="middle">${p.label}</text>
      `;
    }
  });

  // Data point markers
  let circlesHtml = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#FFFFFF" stroke="${themeColor}" stroke-width="2.5">
      <title>${p.label}: ${p.val.toLocaleString()} ${metricKey}</title>
    </circle>
  `).join('');

  // 6. Highlight Callout Pin on Final Point (Nov 15) to explicitly display data match (e.g. 28 Rejected)
  const last = points[points.length - 1];
  const calloutVal = Number(last.val).toLocaleString();
  const calloutText = `${calloutVal} ${metricKey}`;
  const tagW = 86;
  const tagH = 22;
  const tagX = Math.min(last.x - tagW / 2 + 5, width - padding.right - tagW);
  const tagY = Math.max(last.y - 28, padding.top - 2);

  const calloutHtml = `
    <g>
      <circle cx="${last.x}" cy="${last.y}" r="8" fill="${themeColor}" fill-opacity="0.25">
        <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite"/>
      </circle>
      <rect x="${tagX}" y="${tagY}" width="${tagW}" height="${tagH}" rx="4" fill="${themeColor}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))" />
      <polygon points="${last.x - 4},${tagY + tagH} ${last.x + 4},${tagY + tagH} ${last.x},${tagY + tagH + 5}" fill="${themeColor}" />
      <text x="${tagX + tagW / 2}" y="${tagY + 14.5}" fill="#FFFFFF" font-size="11" font-weight="700" text-anchor="middle">${calloutText}</text>
    </g>
  `;

  // Render SVG
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${themeColor}" stop-opacity="0.32" />
        <stop offset="100%" stop-color="${themeColor}" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    ${gridHtml}
    ${yAxisLine}
    ${xAxisLine}
    <path d="${areaD}" fill="url(#areaGradient)" />
    <path d="${pathD}" fill="none" stroke="${themeColor}" stroke-width="3" stroke-linecap="round" />
    ${circlesHtml}
    ${xLabelsHtml}
    ${calloutHtml}
  `;
}

function handleTrendMetricChange() {
  const metric = document.getElementById('trendMetricSelect').value;
  if (dashboardDataCache && dashboardDataCache.inspectionTrends) {
    renderTrendChart(dashboardDataCache.inspectionTrends, metric);
  }
}

// ==========================================
// CHART 3: PRODUCTION & DISPATCH BY GRADE
// ==========================================
const gradeDataSets = {
  all: [
    { grade: 'API 5L X65', produced: 4200, dispatched: 3100 },
    { grade: 'API 5L X70', produced: 3450, dispatched: 2600 },
    { grade: 'API 5CT L80', produced: 2800, dispatched: 2250 },
    { grade: 'API 5CT J55', produced: 1950, dispatched: 1600 },
    { grade: 'API 5L X52', produced: 1450, dispatched: 1100 }
  ],
  casing: [
    { grade: 'API 5CT L80', produced: 2800, dispatched: 2250 },
    { grade: 'API 5CT J55', produced: 1950, dispatched: 1600 },
    { grade: 'API 5CT P110', produced: 1850, dispatched: 1400 },
    { grade: 'API 5CT N80', produced: 1200, dispatched: 950 }
  ],
  linepipe: [
    { grade: 'API 5L X65', produced: 4200, dispatched: 3100 },
    { grade: 'API 5L X70', produced: 3450, dispatched: 2600 },
    { grade: 'API 5L X52', produced: 1450, dispatched: 1100 },
    { grade: 'API 5L X80', produced: 980, dispatched: 820 }
  ]
};

function renderGradeBarChart() {
  const svg = document.getElementById('gradeBarChartSvg');
  if (!svg) return;

  const filterEl = document.getElementById('gradeCategoryFilter');
  const category = (filterEl && filterEl.value) || 'all';
  const data = gradeDataSets[category] || gradeDataSets.all;

  const width = 520;
  const height = 230;
  const padding = { top: 25, right: 20, bottom: 35, left: 45 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = 4800;

  // Y-axis ticks
  const yTicks = [0, 1200, 2400, 3600, 4800];
  let gridHtml = '';
  yTicks.forEach(tick => {
    const y = padding.top + chartH - (tick / maxVal) * chartH;
    gridHtml += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E2E8F0" stroke-dasharray="3 3" />
      <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#64748B" font-weight="600" text-anchor="end">${tick >= 1000 ? (tick/1000) + 'k' : tick}</text>
    `;
  });

  const groupWidth = chartW / data.length;
  const barWidth = Math.min(22, (groupWidth - 24) / 2);

  let barsHtml = '';
  data.forEach((item, idx) => {
    const groupCenter = padding.left + (idx + 0.5) * groupWidth;
    
    // Produced Bar (Deep Navy #0B192C)
    const prodH = Math.max(4, (item.produced / maxVal) * chartH);
    const prodX = groupCenter - barWidth - 2;
    const prodY = padding.top + chartH - prodH;

    // Dispatched Bar (ArcelorMittal Orange #F15A24)
    const dispH = Math.max(4, (item.dispatched / maxVal) * chartH);
    const dispX = groupCenter + 2;
    const dispY = padding.top + chartH - dispH;

    barsHtml += `
      <g class="bar-group" style="cursor: pointer;">
        <!-- Produced Bar -->
        <rect x="${prodX}" y="${prodY}" width="${barWidth}" height="${prodH}" rx="3" fill="#0B192C">
          <title>${item.grade} Produced: ${item.produced.toLocaleString()} MT</title>
        </rect>
        <text x="${prodX + barWidth / 2}" y="${prodY - 5}" font-size="9" font-weight="700" fill="#0B192C" text-anchor="middle">${(item.produced/1000).toFixed(1)}k</text>

        <!-- Dispatched Bar -->
        <rect x="${dispX}" y="${dispY}" width="${barWidth}" height="${dispH}" rx="3" fill="#F15A24">
          <title>${item.grade} Dispatched: ${item.dispatched.toLocaleString()} MT</title>
        </rect>
        <text x="${dispX + barWidth / 2}" y="${dispY - 5}" font-size="9" font-weight="700" fill="#F15A24" text-anchor="middle">${(item.dispatched/1000).toFixed(1)}k</text>

        <!-- X Label -->
        <text x="${groupCenter}" y="${height - 10}" font-size="11" font-weight="600" fill="#334155" text-anchor="middle">${item.grade}</text>
      </g>
    `;
  });

  svg.innerHTML = `
    ${gridHtml}
    ${barsHtml}
  `;
}

// ==========================================
// CHART 4: YARD STORAGE & BAY CAPACITY
// ==========================================
const yardBaysData = [
  { name: 'Bay 1: Heavy Wall Casing', occupied: 3520, capacity: 4000, pct: 88, status: 'High Occupancy' },
  { name: 'Bay 2: Seamless Tubing', occupied: 2880, capacity: 4500, pct: 64, status: 'Optimal' },
  { name: 'Bay 3: Drill Pipe Staging', occupied: 2300, capacity: 2500, pct: 92, status: 'Near Capacity' },
  { name: 'Bay 4: Coated Line Pipe', occupied: 2400, capacity: 5000, pct: 48, status: 'Available' },
  { name: 'Bay 5: Rail Dispatch Yard', occupied: 1850, capacity: 2500, pct: 74, status: 'Active Dispatch' }
];

function renderYardBays() {
  const container = document.getElementById('yardBaysContainer');
  if (!container) return;

  container.innerHTML = yardBaysData.map(bay => {
    let gradColor = 'linear-gradient(90deg, #10B981, #059669)';
    if (bay.pct >= 90) {
      gradColor = 'linear-gradient(90deg, #F59E0B, #DC2626)';
    } else if (bay.pct >= 75) {
      gradColor = 'linear-gradient(90deg, #F97316, #F15A24)';
    }

    return `
      <div class="yard-bay-item">
        <div class="yard-bay-meta">
          <div class="yard-bay-name">
            <span style="font-size: 13px;">🏭</span>
            <span>${bay.name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="yard-bay-stats">${bay.occupied.toLocaleString()} / ${bay.capacity.toLocaleString()} Pipes</span>
            <span class="badge ${bay.pct >= 90 ? 'badge-inactive' : 'badge-active'}" style="font-size: 11px; padding: 2px 7px;">
              ${bay.pct}%
            </span>
          </div>
        </div>
        <div class="yard-progress-track">
          <div class="yard-progress-fill" style="width: ${bay.pct}%; background: ${gradColor};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// SCREEN 2: USER MANAGEMENT
// ==========================================
async function loadUsers() {
  const searchEl = document.getElementById('userSearchInput');
  const statusEl = document.getElementById('userStatusFilter');
  const roleEl = document.getElementById('userRoleFilter');

  const search = searchEl ? searchEl.value.trim() : '';
  const status = statusEl ? statusEl.value : 'All';
  const role = roleEl ? roleEl.value : 'All';

  usersState.search = search;
  usersState.status = status;
  usersState.role = role;

  const url = `/api/users?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&role=${encodeURIComponent(role)}&page=${usersState.page}&pageSize=${usersState.pageSize}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    usersState.total = data.total;
    usersState.totalPages = data.totalPages;

    renderUsersTable(data.items);
    renderUsersPagination(data.total, data.page, data.pageSize, data.totalPages);
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color: #94A3B8;">No users found matching your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight: 600; color: #0F172A;">${u.employeeId}</td>
      <td style="font-weight: 600;">${u.name}</td>
      <td style="color: #475569;">${u.email}</td>
      <td><span style="font-weight: 500;">${u.role}</span></td>
      <td>
        <span class="status-badge ${(u.status || 'Active').toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}">
          ${u.status || 'Active'}
        </span>
      </td>
      <td>
        <div class="action-buttons-cell">
          <button class="table-action-btn" title="Edit User" onclick="openEditUserModal('${u.employeeId}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="table-action-btn btn-delete" title="Delete User" onclick="openDeleteUserModal('${u.employeeId}', '${u.name}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderUsersPagination(total, page, pageSize, totalPages) {
  const infoEl = document.getElementById('usersPaginationInfo');
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  infoEl.textContent = `Showing ${start} - ${end} of ${total} users`;

  const ctrlEl = document.getElementById('usersPaginationControls');
  let btnsHtml = `
    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="goToUsersPage(${page - 1})">&lt;</button>
  `;

  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    btnsHtml += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToUsersPage(${i})">${i}</button>`;
  }

  if (totalPages > 5) {
    btnsHtml += `<span style="padding: 0 4px; color: #94A3B8;">...</span>`;
    btnsHtml += `<button class="page-btn ${totalPages === page ? 'active' : ''}" onclick="goToUsersPage(${totalPages})">${totalPages}</button>`;
  }

  btnsHtml += `
    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="goToUsersPage(${page + 1})">&gt;</button>
  `;

  ctrlEl.innerHTML = btnsHtml;
}

function goToUsersPage(p) {
  usersState.page = p;
  loadUsers();
}

function toggleSelectAllUsers(master) {
  document.querySelectorAll('.user-row-select').forEach(cb => {
    cb.checked = master.checked;
  });
}

// User CRUD Modals
let editingUserId = null;

async function getNextEmployeeId() {
  try {
    const res = await fetch('/api/users/next-id');
    if (res.ok) {
      const data = await res.json();
      if (data && data.nextId) return data.nextId;
    }
  } catch (e) {
    console.warn('Fallback to default sequence:', e);
  }
  return 'EMP057';
}

async function openAddUserModal() {
  editingUserId = null;
  document.getElementById('userModalTitle').textContent = 'Add New User';
  
  const empInput = document.getElementById('userModalEmpId');
  empInput.value = 'EMP057'; // Starts from 57 by default
  empInput.readOnly = true;
  empInput.style.backgroundColor = '#F8FAFC';
  empInput.style.cursor = 'not-allowed';
  
  document.getElementById('userModalName').value = '';
  document.getElementById('userModalEmail').value = '';
  document.getElementById('userModalRole').value = 'Engineer';
  document.getElementById('userModalStatus').value = 'Active';
  document.getElementById('userModal').classList.add('open');

  // Query server to get latest sequential ID (57, 58, 59...)
  const nextId = await getNextEmployeeId();
  if (nextId) {
    empInput.value = nextId;
  }
}

async function openEditUserModal(empId) {
  editingUserId = empId;
  try {
    const res = await fetch(`/api/users?search=${encodeURIComponent(empId)}`);
    const data = await res.json();
    const user = data.items.find(u => u.employeeId === empId) || data.items[0];

    document.getElementById('userModalTitle').textContent = 'Edit User';
    const empInput = document.getElementById('userModalEmpId');
    empInput.value = user.employeeId;
    empInput.readOnly = true;
    empInput.style.backgroundColor = '#F8FAFC';
    empInput.style.cursor = 'not-allowed';
    
    document.getElementById('userModalName').value = user.name;
    document.getElementById('userModalEmail').value = user.email;
    document.getElementById('userModalRole').value = user.role;
    document.getElementById('userModalStatus').value = user.status;
    document.getElementById('userModal').classList.add('open');
  } catch (err) {
    showToast('Failed to load user info', 'error');
  }
}

async function saveUserModal() {
  const empId = document.getElementById('userModalEmpId').value.trim();
  const name = document.getElementById('userModalName').value.trim();
  const email = document.getElementById('userModalEmail').value.trim();
  const role = document.getElementById('userModalRole').value;
  const status = document.getElementById('userModalStatus').value;

  if (!empId || !name || !email) {
    alert('Please fill in all required fields.');
    return;
  }

  const payload = { employeeId: empId, name, email, role, status };

  try {
    let res;
    if (editingUserId) {
      res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (res.ok) {
      closeUserModal();
      showToast(editingUserId ? 'User updated successfully' : 'New user created successfully');
      loadUsers();
    } else {
      alert(data.message || 'Operation failed');
    }
  } catch (err) {
    showToast('Network error while saving user', 'error');
  }
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('open');
}

let pendingDeleteUserId = null;
function openDeleteUserModal(empId, name) {
  pendingDeleteUserId = empId;
  document.getElementById('deleteUserNameSpan').textContent = `${name} (${empId})`;
  document.getElementById('deleteUserModal').classList.add('open');
}

function closeDeleteUserModal() {
  pendingDeleteUserId = null;
  document.getElementById('deleteUserModal').classList.remove('open');
}

async function confirmDeleteUser() {
  if (!pendingDeleteUserId) return;
  try {
    const res = await fetch(`/api/users/${pendingDeleteUserId}`, { method: 'DELETE' });
    if (res.ok) {
      closeDeleteUserModal();
      showToast('User deleted successfully');
      loadUsers();
    } else {
      showToast('Failed to delete user', 'error');
    }
  } catch (err) {
    showToast('Error deleting user', 'error');
  }
}

// ==========================================
// SCREEN 3: ROLE & PERMISSIONS
// ==========================================
async function loadRoles() {
  const searchInput = document.getElementById('roleSearchInput');
  const search = searchInput ? searchInput.value.trim() : '';
  try {
    const res = await fetch(`/api/roles?search=${encodeURIComponent(search)}`);
    const roles = await res.json();
    renderRolesTable(roles);
    updateRoleDropdowns(roles);
  } catch (err) {
    console.error('Failed to load roles:', err);
  }
}

function updateRoleDropdowns(roles) {
  if (!roles || !roles.length) return;
  const userRoleFilter = document.getElementById('userRoleFilter');
  if (userRoleFilter) {
    const currentVal = userRoleFilter.value;
    const baseRoles = ['Administrator', 'Engineer', 'Supervisor', 'Operator'];
    const allRoleNames = Array.from(new Set([...baseRoles, ...roles.map(r => r.name)]));
    userRoleFilter.innerHTML = `<option value="All">All</option>` + allRoleNames.map(r => `<option value="${r}">${r}</option>`).join('');
    if (allRoleNames.includes(currentVal) || currentVal === 'All') {
      userRoleFilter.value = currentVal;
    }
  }
}

function renderRolesTable(roles) {
  const tbody = document.getElementById('rolesTableBody');
  if (!roles || roles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px; color: #94A3B8;">No roles found.</td></tr>`;
    return;
  }

  tbody.innerHTML = roles.map(r => `
    <tr>
      <td style="font-weight: 700; color: #0F172A;">
        <a href="#" onclick="switchView('permissions', '${r.name}'); return false;" style="color: inherit; text-decoration: none;">
          ${r.name}
        </a>
      </td>
      <td style="color: #475569;">${r.description}</td>
      <td style="font-weight: 700;">${r.users}</td>
      <td>
        <div class="action-buttons-cell">
          <button class="table-action-btn" title="Configure Matrix" onclick="switchView('permissions', '${r.name}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </button>
          <button class="table-action-btn" title="Edit Role" onclick="openEditRoleModal('${r.name}', '${r.description}', '${r.status}', '${r.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          ${r.name !== 'Administrator' ? `
            <button class="table-action-btn btn-delete" title="Delete Role" onclick="deleteRolePrompt('${r.name}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

let editingRoleId = null;
function openAddRoleModal() {
  editingRoleId = null;
  document.getElementById('roleModalTitle').textContent = 'Add New Role';
  document.getElementById('roleModalName').value = '';
  document.getElementById('roleModalName').disabled = false;
  document.getElementById('roleModalDesc').value = '';
  document.getElementById('roleModalStatus').value = 'Active';
  document.getElementById('roleModal').classList.add('open');
}

function openEditRoleModal(name, desc, status, id) {
  editingRoleId = id;
  document.getElementById('roleModalTitle').textContent = 'Edit Role';
  document.getElementById('roleModalName').value = name;
  document.getElementById('roleModalName').disabled = true;
  document.getElementById('roleModalDesc').value = desc;
  document.getElementById('roleModalStatus').value = status;
  document.getElementById('roleModal').classList.add('open');
}

function closeRoleModal() {
  document.getElementById('roleModal').classList.remove('open');
}

async function saveRoleModal() {
  const name = document.getElementById('roleModalName').value.trim();
  const desc = document.getElementById('roleModalDesc').value.trim();
  const status = document.getElementById('roleModalStatus').value;

  if (!name || !desc) {
    alert('Please enter both Role Name and Description.');
    return;
  }

  try {
    let res;
    if (editingRoleId) {
      res = await fetch(`/api/roles/${editingRoleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingRoleId, name, description: desc, status })
      });
    } else {
      res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, status, users: 0 })
      });
    }

    if (res.ok) {
      closeRoleModal();
      showToast(editingRoleId ? 'Role updated' : 'Role created successfully');
      loadRoles();
    } else {
      const d = await res.json();
      alert(d.message || 'Operation failed');
    }
  } catch (err) {
    showToast('Error saving role', 'error');
  }
}

async function deleteRolePrompt(roleName) {
  if (!confirm(`Are you sure you want to delete role '${roleName}'?`)) return;
  try {
    const res = await fetch(`/api/roles/${encodeURIComponent(roleName)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Role ${roleName} deleted`);
      loadRoles();
    } else {
      const d = await res.json();
      alert(d.message || 'Cannot delete role');
    }
  } catch (err) {
    showToast('Failed to delete role', 'error');
  }
}

// ==========================================
// SCREEN 4: PERMISSION MATRIX
// ==========================================
async function loadPermissionMatrix(roleName) {
  currentRoleForMatrix = roleName;
  document.getElementById('roleMatrixSelector').value = roleName;

  try {
    const res = await fetch(`/api/permissions/${encodeURIComponent(roleName)}`);
    const data = await res.json();
    currentPermissions = data;
    renderMatrixTable(data.modules);
  } catch (err) {
    console.error('Failed to load permission matrix:', err);
  }
}

function handleRoleMatrixChange() {
  const selected = document.getElementById('roleMatrixSelector').value;
  loadPermissionMatrix(selected);
}

function renderMatrixTable(modules) {
  const tbody = document.getElementById('permissionMatrixTbody');
  if (!modules || modules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No modules found.</td></tr>`;
    return;
  }

  const getModuleIconSvg = (modName) => {
    switch (modName) {
      case 'Pipe Identification':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>';
      case 'Digital Tally':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
      case 'Rig Operations':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20M7 20v-8M17 20v-8M7 12h10M12 4v8"></path></svg>';
      case 'Stock Management':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>';
      case 'Storage Locations':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
      case 'Quality & Inspection':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      case 'MTC & Documents':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
      case 'Analytics & Reports':
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>';
      default:
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>';
    }
  };

  tbody.innerHTML = modules.map((m, idx) => `
    <tr>
      <td>
        <div class="module-cell">
          <div class="module-icon">${getModuleIconSvg(m.moduleName)}</div>
          <span>${m.moduleName}</span>
        </div>
      </td>
      <td style="text-align: center;"><input type="checkbox" class="custom-checkbox perm-chk" data-idx="${idx}" data-field="view" ${m.view ? 'checked' : ''}></td>
      <td style="text-align: center;"><input type="checkbox" class="custom-checkbox perm-chk" data-idx="${idx}" data-field="create" ${m.create ? 'checked' : ''}></td>
      <td style="text-align: center;"><input type="checkbox" class="custom-checkbox perm-chk" data-idx="${idx}" data-field="edit" ${m.edit ? 'checked' : ''}></td>
      <td style="text-align: center;"><input type="checkbox" class="custom-checkbox perm-chk" data-idx="${idx}" data-field="delete" ${m.delete ? 'checked' : ''}></td>
      <td style="text-align: center;"><input type="checkbox" class="custom-checkbox perm-chk" data-idx="${idx}" data-field="approve" ${m.approve ? 'checked' : ''}></td>
    </tr>
  `).join('');
}

async function savePermissionMatrix() {
  if (!currentPermissions) return;

  const checkboxes = document.querySelectorAll('.perm-chk');
  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.idx);
    const field = cb.dataset.field;
    if (currentPermissions.modules[idx]) {
      currentPermissions.modules[idx][field] = cb.checked;
    }
  });

  try {
    const res = await fetch('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPermissions)
    });

    if (res.ok) {
      showToast(`Permissions updated for role ${currentPermissions.roleName}`);
    } else {
      showToast('Failed to save permissions', 'error');
    }
  } catch (err) {
    showToast('Network error saving permissions', 'error');
  }
}

function cancelPermissionChanges() {
  if (confirm('Discard changes and reload original permissions?')) {
    loadPermissionMatrix(currentRoleForMatrix);
  }
}

// ==========================================
// SCREEN 5: APPLICATION SETTINGS (ALL 5 TABS)
// ==========================================
let currentSettingsState = {
  rejectionReasons: [
    { id: "1", name: "Crack", status: "Active" },
    { id: "2", name: "Corrosion", status: "Active" },
    { id: "3", name: "Out of Tolerance", status: "Active" },
    { id: "4", name: "Thread Damage", status: "Active" },
    { id: "5", name: "Other", status: "Active" }
  ],
  alertConfigurations: [
    { type: "Inspection Rejected", inApp: true, email: true, sms: false },
    { type: "Duplicate Pipe Detected", inApp: true, email: true, sms: true },
    { type: "Stock Count Threshold", inApp: true, email: true, sms: false },
    { type: "Tally Approval Pending", inApp: true, email: false, sms: false },
    { type: "System Alerts & Errors", inApp: true, email: true, sms: true }
  ]
};

let editingRejectionReasonId = null;

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    currentSettingsState = s;

    // TAB 1: General
    if (document.getElementById('settCompanyName')) document.getElementById('settCompanyName').value = s.companyName || 'ArcelorMittal Tubular Products';
    if (document.getElementById('settDefaultUnit')) document.getElementById('settDefaultUnit').value = s.defaultUnit || 'Metric (m, mm, kg)';
    if (document.getElementById('settDateFormat')) document.getElementById('settDateFormat').value = s.dateFormat || 'DD-MMM-YYYY';
    if (document.getElementById('settTimeZone')) document.getElementById('settTimeZone').value = s.timeZone || '(GMT+04:00) Abu Dhabi';
    if (document.getElementById('settSessionTimeout')) document.getElementById('settSessionTimeout').value = s.sessionTimeoutMinutes || 30;

    if (document.getElementById('toggleMixWarning')) document.getElementById('toggleMixWarning').checked = s.enableMixWarning ?? true;
    if (document.getElementById('toggleDuplicatePipe')) document.getElementById('toggleDuplicatePipe').checked = s.enableDuplicatePipeCheck ?? true;
    if (document.getElementById('toggleRejectionReasons')) document.getElementById('toggleRejectionReasons').checked = s.enableRejectionReasons ?? true;
    if (document.getElementById('toggleStockUpload')) document.getElementById('toggleStockUpload').checked = s.enableStockCountUpload ?? true;
    if (document.getElementById('toggleAuditTrail')) document.getElementById('toggleAuditTrail').checked = s.enableAuditTrail ?? true;

    // TAB 2: Pipe & Tally
    if (document.getElementById('settPipeIdPrefix')) document.getElementById('settPipeIdPrefix').value = s.pipeIdPrefix || 'P-';
    if (document.getElementById('settJointNumberStart')) document.getElementById('settJointNumberStart').value = s.jointNumberStart ?? 1;
    if (document.getElementById('settDefaultConnectionType')) document.getElementById('settDefaultConnectionType').value = s.defaultConnectionType || 'API';
    if (document.getElementById('settDefaultDriftType')) document.getElementById('settDefaultDriftType').value = s.defaultDriftType || 'Full Drift';
    if (document.getElementById('settEffectiveLengthUnit')) document.getElementById('settEffectiveLengthUnit').value = s.effectiveLengthUnit || 'm (Meter)';

    if (document.getElementById('toggleAllowTallyCreation')) document.getElementById('toggleAllowTallyCreation').checked = s.allowTallyCreation ?? true;
    if (document.getElementById('toggleAllowTallyEditing')) document.getElementById('toggleAllowTallyEditing').checked = s.allowTallyEditing ?? true;
    if (document.getElementById('toggleEnforceUniquePipe')) document.getElementById('toggleEnforceUniquePipe').checked = s.enforceUniquePipeInTally ?? true;
    if (document.getElementById('toggleAutoSequence')) document.getElementById('toggleAutoSequence').checked = s.autoGenerateJointSequence ?? true;
    if (document.getElementById('toggleAllowTallyClosure')) document.getElementById('toggleAllowTallyClosure').checked = s.allowTallyClosure ?? true;

    // TAB 3: Inspection & Quality
    if (document.getElementById('settInspectionThreshold')) document.getElementById('settInspectionThreshold').value = s.inspectionThresholdMm ?? 0.25;
    if (document.getElementById('settDefaultInspectionType')) document.getElementById('settDefaultInspectionType').value = s.defaultInspectionType || 'Dimensional';
    if (document.getElementById('settMaxReworkAttempts')) document.getElementById('settMaxReworkAttempts').value = s.maxReworkAttempts ?? 2;
    if (document.getElementById('settInspectionValidity')) document.getElementById('settInspectionValidity').value = s.inspectionValidityDays ?? 180;

    renderRejectionReasons(s.rejectionReasons || currentSettingsState.rejectionReasons);

    // TAB 4: Notifications
    renderAlertConfigTable(s.alertConfigurations || currentSettingsState.alertConfigurations);
    if (document.getElementById('toggleEnableNotifications')) document.getElementById('toggleEnableNotifications').checked = s.enableNotifications ?? true;
    if (document.getElementById('settNotificationFrequency')) document.getElementById('settNotificationFrequency').value = s.notificationFrequency || 'Real-time';
    if (document.getElementById('toggleDailySummaryEmail')) document.getElementById('toggleDailySummaryEmail').checked = s.dailySummaryEmail ?? true;
    if (document.getElementById('settRecipientsAdmin')) document.getElementById('settRecipientsAdmin').value = s.recipientsAdmin || 'admin@arcelormittal.com';

    // TAB 5: System
    if (document.getElementById('settAppVersion')) document.getElementById('settAppVersion').value = s.applicationVersion || 'v1.0.0';
    if (document.getElementById('settEnvironment')) document.getElementById('settEnvironment').value = s.environment || 'Production';
    if (document.getElementById('settSystemName')) document.getElementById('settSystemName').value = s.systemName || 'Pipe Traceability Web Portal';
    if (document.getElementById('settLastUpdated')) document.getElementById('settLastUpdated').value = s.lastUpdated || 'Jun 15, 2025 10:24';

    if (document.getElementById('toggleEnableAutoBackup')) document.getElementById('toggleEnableAutoBackup').checked = s.enableAutoBackup ?? true;
    if (document.getElementById('settBackupFrequency')) document.getElementById('settBackupFrequency').value = s.backupFrequency || 'Daily';
    if (document.getElementById('settRetentionPeriod')) document.getElementById('settRetentionPeriod').value = s.retentionPeriodDays ?? 90;
    if (document.getElementById('settBackupLocation')) document.getElementById('settBackupLocation').value = s.backupLocation || 'D:\\Backups\\PipeTraceability';

    if (document.getElementById('toggleEnableMfa')) document.getElementById('toggleEnableMfa').checked = s.enableMfa ?? true;
    if (document.getElementById('toggleEnableSso')) document.getElementById('toggleEnableSso').checked = s.enableSso ?? false;
    if (document.getElementById('toggleErpIntegration')) document.getElementById('toggleErpIntegration').checked = s.erpIntegrationApi ?? true;
    if (document.getElementById('toggleDataWarehouse')) document.getElementById('toggleDataWarehouse').checked = s.dataWarehouseIntegration ?? true;
    if (document.getElementById('settLogRetention')) document.getElementById('settLogRetention').value = s.logRetentionDays ?? 365;

  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function renderRejectionReasons(list) {
  const tbody = document.getElementById('rejectionReasonsTableBody');
  if (!tbody) return;
  currentSettingsState.rejectionReasons = list;

  tbody.innerHTML = list.map(item => `
    <tr>
      <td style="font-weight: 500; color: #1E293B;">${item.name}</td>
      <td>
        <span class="badge ${item.status === 'Active' ? 'badge-active' : 'badge-inactive'}">
          ${item.status}
        </span>
      </td>
      <td style="text-align: center;">
        <div class="action-buttons-cell" style="justify-content: center;">
          <button class="table-action-btn" title="Edit Reason" onclick="openEditRejectionReasonModal('${item.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="table-action-btn btn-delete" title="Delete Reason" onclick="deleteRejectionReason('${item.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddRejectionReasonModal() {
  editingRejectionReasonId = null;
  document.getElementById('rejectionReasonModalTitle').textContent = 'Add Rejection Reason';
  document.getElementById('rejectionReasonNameInput').value = '';
  document.getElementById('rejectionReasonStatusSelect').value = 'Active';
  document.getElementById('rejectionReasonModal').classList.add('open');
}

function openEditRejectionReasonModal(id) {
  const item = currentSettingsState.rejectionReasons.find(r => r.id === id);
  if (!item) return;
  editingRejectionReasonId = id;
  document.getElementById('rejectionReasonModalTitle').textContent = 'Edit Rejection Reason';
  document.getElementById('rejectionReasonNameInput').value = item.name;
  document.getElementById('rejectionReasonStatusSelect').value = item.status;
  document.getElementById('rejectionReasonModal').classList.add('open');
}

function closeRejectionReasonModal() {
  document.getElementById('rejectionReasonModal').classList.remove('open');
}

function saveRejectionReasonModal() {
  const name = document.getElementById('rejectionReasonNameInput').value.trim();
  const status = document.getElementById('rejectionReasonStatusSelect').value;

  if (!name) {
    alert('Please enter a rejection reason name.');
    return;
  }

  if (editingRejectionReasonId) {
    const item = currentSettingsState.rejectionReasons.find(r => r.id === editingRejectionReasonId);
    if (item) {
      item.name = name;
      item.status = status;
    }
  } else {
    const newId = String(Date.now()).slice(-5);
    currentSettingsState.rejectionReasons.push({ id: newId, name, status });
  }

  renderRejectionReasons(currentSettingsState.rejectionReasons);
  closeRejectionReasonModal();
  saveSettings();
}

function deleteRejectionReason(id) {
  if (confirm('Are you sure you want to remove this rejection reason?')) {
    currentSettingsState.rejectionReasons = currentSettingsState.rejectionReasons.filter(r => r.id !== id);
    renderRejectionReasons(currentSettingsState.rejectionReasons);
    saveSettings();
  }
}

function renderAlertConfigTable(configs) {
  const tbody = document.getElementById('alertConfigTableBody');
  if (!tbody) return;
  currentSettingsState.alertConfigurations = configs;

  const iconForType = (type) => {
    if (type.includes('Rejected')) {
      return `<span style="color: #F15A24; margin-right: 8px;">🔔</span>`;
    } else if (type.includes('Duplicate')) {
      return `<span style="color: #F59E0B; margin-right: 8px;">⚠️</span>`;
    } else if (type.includes('Stock')) {
      return `<span style="color: #3B82F6; margin-right: 8px;">📊</span>`;
    } else if (type.includes('Tally')) {
      return `<span style="color: #10B981; margin-right: 8px;">⏱️</span>`;
    } else {
      return `<span style="color: #EF4444; margin-right: 8px;">⚠️</span>`;
    }
  };

  tbody.innerHTML = configs.map((item, index) => `
    <tr>
      <td style="font-weight: 500; color: #1E293B;">
        ${iconForType(item.type)}${item.type}
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="settings-checkbox" id="alertInApp_${index}" ${item.inApp ? 'checked' : ''} onchange="updateAlertConfig(${index}, 'inApp', this.checked)">
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="settings-checkbox" id="alertEmail_${index}" ${item.email ? 'checked' : ''} onchange="updateAlertConfig(${index}, 'email', this.checked)">
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="settings-checkbox" id="alertSms_${index}" ${item.sms ? 'checked' : ''} onchange="updateAlertConfig(${index}, 'sms', this.checked)">
      </td>
    </tr>
  `).join('');
}

function updateAlertConfig(index, key, value) {
  if (currentSettingsState.alertConfigurations && currentSettingsState.alertConfigurations[index]) {
    currentSettingsState.alertConfigurations[index][key] = value;
  }
}

async function saveSettings() {
  const payload = {
    // Tab 1: General
    companyName: document.getElementById('settCompanyName').value.trim(),
    defaultUnit: document.getElementById('settDefaultUnit').value,
    dateFormat: document.getElementById('settDateFormat').value,
    timeZone: document.getElementById('settTimeZone').value,
    sessionTimeoutMinutes: parseInt(document.getElementById('settSessionTimeout').value),
    enableMixWarning: document.getElementById('toggleMixWarning').checked,
    enableDuplicatePipeCheck: document.getElementById('toggleDuplicatePipe').checked,
    enableRejectionReasons: document.getElementById('toggleRejectionReasons').checked,
    enableStockCountUpload: document.getElementById('toggleStockUpload').checked,
    enableAuditTrail: document.getElementById('toggleAuditTrail').checked,

    // Tab 2: Pipe & Tally
    pipeIdPrefix: document.getElementById('settPipeIdPrefix').value.trim(),
    jointNumberStart: parseInt(document.getElementById('settJointNumberStart').value) || 1,
    defaultConnectionType: document.getElementById('settDefaultConnectionType').value,
    defaultDriftType: document.getElementById('settDefaultDriftType').value,
    effectiveLengthUnit: document.getElementById('settEffectiveLengthUnit').value,
    allowTallyCreation: document.getElementById('toggleAllowTallyCreation').checked,
    allowTallyEditing: document.getElementById('toggleAllowTallyEditing').checked,
    enforceUniquePipeInTally: document.getElementById('toggleEnforceUniquePipe').checked,
    autoGenerateJointSequence: document.getElementById('toggleAutoSequence').checked,
    allowTallyClosure: document.getElementById('toggleAllowTallyClosure').checked,

    // Tab 3: Inspection & Quality
    inspectionThresholdMm: parseFloat(document.getElementById('settInspectionThreshold').value) || 0.25,
    defaultInspectionType: document.getElementById('settDefaultInspectionType').value,
    maxReworkAttempts: parseInt(document.getElementById('settMaxReworkAttempts').value) || 2,
    inspectionValidityDays: parseInt(document.getElementById('settInspectionValidity').value) || 180,
    rejectionReasons: currentSettingsState.rejectionReasons,

    // Tab 4: Notifications
    alertConfigurations: currentSettingsState.alertConfigurations,
    enableNotifications: document.getElementById('toggleEnableNotifications').checked,
    notificationFrequency: document.getElementById('settNotificationFrequency').value,
    dailySummaryEmail: document.getElementById('toggleDailySummaryEmail').checked,
    recipientsAdmin: document.getElementById('settRecipientsAdmin').value.trim(),

    // Tab 5: System
    applicationVersion: document.getElementById('settAppVersion').value,
    environment: document.getElementById('settEnvironment').value,
    systemName: document.getElementById('settSystemName').value.trim(),
    lastUpdated: document.getElementById('settLastUpdated').value,
    enableAutoBackup: document.getElementById('toggleEnableAutoBackup').checked,
    backupFrequency: document.getElementById('settBackupFrequency').value,
    retentionPeriodDays: parseInt(document.getElementById('settRetentionPeriod').value) || 90,
    backupLocation: document.getElementById('settBackupLocation').value.trim(),
    enableMfa: document.getElementById('toggleEnableMfa').checked,
    enableSso: document.getElementById('toggleEnableSso').checked,
    erpIntegrationApi: document.getElementById('toggleErpIntegration').checked,
    dataWarehouseIntegration: document.getElementById('toggleDataWarehouse').checked,
    logRetentionDays: parseInt(document.getElementById('settLogRetention').value) || 365
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast('Settings saved successfully and persisted to database');
    } else {
      showToast('Failed to save settings', 'error');
    }
  } catch (err) {
    showToast('Error saving settings', 'error');
  }
}

function resetSettings() {
  if (confirm('Reset settings across all tabs to system defaults?')) {
    // Reset all tabs to defaults
    document.getElementById('settCompanyName').value = 'ArcelorMittal Tubular Products';
    document.getElementById('settDefaultUnit').value = 'Metric (m, mm, kg)';
    document.getElementById('settDateFormat').value = 'DD-MMM-YYYY';
    document.getElementById('settTimeZone').value = '(GMT+04:00) Abu Dhabi';
    document.getElementById('settSessionTimeout').value = '30';
    document.getElementById('toggleMixWarning').checked = true;
    document.getElementById('toggleDuplicatePipe').checked = true;
    document.getElementById('toggleRejectionReasons').checked = true;
    document.getElementById('toggleStockUpload').checked = true;
    document.getElementById('toggleAuditTrail').checked = true;

    document.getElementById('settPipeIdPrefix').value = 'P-';
    document.getElementById('settJointNumberStart').value = 1;
    document.getElementById('settDefaultConnectionType').value = 'API';
    document.getElementById('settDefaultDriftType').value = 'Full Drift';
    document.getElementById('settEffectiveLengthUnit').value = 'm (Meter)';
    document.getElementById('toggleAllowTallyCreation').checked = true;
    document.getElementById('toggleAllowTallyEditing').checked = true;
    document.getElementById('toggleEnforceUniquePipe').checked = true;
    document.getElementById('toggleAutoSequence').checked = true;
    document.getElementById('toggleAllowTallyClosure').checked = true;

    document.getElementById('settInspectionThreshold').value = 0.25;
    document.getElementById('settDefaultInspectionType').value = 'Dimensional';
    document.getElementById('settMaxReworkAttempts').value = 2;
    document.getElementById('settInspectionValidity').value = 180;

    currentSettingsState.rejectionReasons = [
      { id: "1", name: "Crack", status: "Active" },
      { id: "2", name: "Corrosion", status: "Active" },
      { id: "3", name: "Out of Tolerance", status: "Active" },
      { id: "4", name: "Thread Damage", status: "Active" },
      { id: "5", name: "Other", status: "Active" }
    ];
    renderRejectionReasons(currentSettingsState.rejectionReasons);

    currentSettingsState.alertConfigurations = [
      { type: "Inspection Rejected", inApp: true, email: true, sms: false },
      { type: "Duplicate Pipe Detected", inApp: true, email: true, sms: true },
      { type: "Stock Count Threshold", inApp: true, email: true, sms: false },
      { type: "Tally Approval Pending", inApp: true, email: false, sms: false },
      { type: "System Alerts & Errors", inApp: true, email: true, sms: true }
    ];
    renderAlertConfigTable(currentSettingsState.alertConfigurations);

    document.getElementById('toggleEnableNotifications').checked = true;
    document.getElementById('settNotificationFrequency').value = 'Real-time';
    document.getElementById('toggleDailySummaryEmail').checked = true;
    document.getElementById('settRecipientsAdmin').value = 'admin@arcelormittal.com';

    document.getElementById('settAppVersion').value = 'v1.0.0';
    document.getElementById('settEnvironment').value = 'Production';
    document.getElementById('settSystemName').value = 'Pipe Traceability Web Portal';
    document.getElementById('settLastUpdated').value = 'Jun 15, 2025 10:24';
    document.getElementById('toggleEnableAutoBackup').checked = true;
    document.getElementById('settBackupFrequency').value = 'Daily';
    document.getElementById('settRetentionPeriod').value = 90;
    document.getElementById('settBackupLocation').value = 'D:\\Backups\\PipeTraceability';
    document.getElementById('toggleEnableMfa').checked = true;
    document.getElementById('toggleEnableSso').checked = false;
    document.getElementById('toggleErpIntegration').checked = true;
    document.getElementById('toggleDataWarehouse').checked = true;
    document.getElementById('settLogRetention').value = 365;

    saveSettings();
  }
}

function switchSettingsSubTab(tabName, btn) {
  document.querySelectorAll('.settings-tab-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const panels = {
    'General': document.getElementById('settingsGeneralContent'),
    'Pipe & Tally': document.getElementById('settingsPipeTallyContent'),
    'Inspection & Quality': document.getElementById('settingsInspectionContent'),
    'Notifications': document.getElementById('settingsNotificationsContent'),
    'System': document.getElementById('settingsSystemContent')
  };

  Object.keys(panels).forEach(key => {
    if (panels[key]) {
      if (key === tabName) {
        panels[key].style.display = key === 'General' ? 'grid' : 'block';
      } else {
        panels[key].style.display = 'none';
      }
    }
  });
}

// ==========================================
// SCREEN 6: AUDIT & ACTIVITY
// ==========================================
async function loadAudits() {
  const search = document.getElementById('auditSearchInput').value.trim();
  auditsState.search = search;
  const { startDate, endDate } = auditsDateState;

  const url = `/api/audits?search=${encodeURIComponent(search)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${auditsState.page}&pageSize=${auditsState.pageSize}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    auditsState.total = data.total;
    auditsState.totalPages = data.totalPages;

    renderAuditsTable(data.items);
    renderAuditsPagination(data.total, data.page, data.pageSize, data.totalPages);
  } catch (err) {
    console.error('Failed to load audits:', err);
  }
}

function renderAuditsTable(audits) {
  const tbody = document.getElementById('auditsTableBody');
  if (!audits || audits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: #94A3B8;">No audit records found for the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = audits.map(a => `
    <tr>
      <td style="color: #475569; white-space: nowrap; font-size: 12.5px;">${a.dateTimeString}</td>
      <td style="font-weight: 700; color: #0F172A;">${a.user}</td>
      <td><span style="font-weight: 600;">${a.action}</span></td>
      <td><span style="color: #475569;">${a.module}</span></td>
      <td style="color: #334155;">${a.details}</td>
    </tr>
  `).join('');
}

function renderAuditsPagination(total, page, pageSize, totalPages) {
  const infoEl = document.getElementById('auditsPaginationInfo');
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  infoEl.textContent = `Showing ${start} - ${end} of ${total} records`;

  const ctrlEl = document.getElementById('auditsPaginationControls');
  let btnsHtml = `
    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="goToAuditsPage(${page - 1})">&lt;</button>
  `;

  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    btnsHtml += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToAuditsPage(${i})">${i}</button>`;
  }

  if (totalPages > 5) {
    btnsHtml += `<span style="padding: 0 4px; color: #94A3B8;">...</span>`;
    btnsHtml += `<button class="page-btn ${totalPages === page ? 'active' : ''}" onclick="goToAuditsPage(${totalPages})">${totalPages}</button>`;
  }

  btnsHtml += `
    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="goToAuditsPage(${page + 1})">&gt;</button>
  `;

  ctrlEl.innerHTML = btnsHtml;
}

function goToAuditsPage(p) {
  auditsState.page = p;
  loadAudits();
}

// Export Audits to CSV
function exportAuditsCsv() {
  const { startDate, endDate } = auditsDateState;
  const search = auditsState.search;
  fetch(`/api/audits?search=${encodeURIComponent(search)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&pageSize=1000`)
    .then(r => r.json())
    .then(data => {
      const rows = [["Date & Time", "User", "Action", "Module", "Details"]];
      data.items.forEach(a => {
        rows.push([`"${a.dateTimeString}"`, `"${a.user}"`, `"${a.action}"`, `"${a.module}"`, `"${a.details}"`]);
      });
      const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ArcelorMittal_AuditTrail_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Audit trail exported successfully');
    });
}

// Dropdown Toggles
function toggleProfileDropdown() {
  const card = document.getElementById('profileDropdownMenu');
  card.classList.toggle('show');
}

function toggleNotificationDropdown() {
  const card = document.getElementById('notificationDropdownMenu');
  card.classList.toggle('show');
}

function openHelpModal() {
  document.getElementById('helpModal').classList.add('open');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.remove('open');
}

// Global click dismisses popovers
window.addEventListener('click', (e) => {
  if (!e.target.closest('.user-profile-widget')) {
    const p = document.getElementById('profileDropdownMenu');
    if (p) p.classList.remove('show');
  }
  if (!e.target.closest('#notificationBtnWrap')) {
    const n = document.getElementById('notificationDropdownMenu');
    if (n) n.classList.remove('show');
  }
  if (!e.target.closest('.date-filter-wrap')) {
    document.querySelectorAll('.date-picker-popover').forEach(pop => pop.classList.remove('show'));
  }
});
