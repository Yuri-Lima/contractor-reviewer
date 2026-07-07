/* Pipeline Health Dashboard — Chart.js visualizations (dark theme) */

const chartDefaults = {
  color: '#9aabbf',
  borderColor: '#243041',
  font: { family: 'Segoe UI, system-ui, sans-serif' },
};

Chart.defaults.color = chartDefaults.color;
Chart.defaults.borderColor = chartDefaults.borderColor;
Chart.defaults.font.family = chartDefaults.font.family;

function initTimelineChart() {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  // Floating-bar style: [start, end] for each job segment
  // Before: Job A and Job B overlap on the same document
  // After: sequential critical sections under lock
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [
        'BEFORE · Job A (doc-1)',
        'BEFORE · Job B (doc-1)',
        'AFTER · Job A (locked)',
        'AFTER · Job B (waits → runs)',
      ],
      datasets: [
        {
          label: 'Parse',
          data: [
            [0, 4],
            [1, 5],
            [0, 3],
            [3, 6],
          ],
          backgroundColor: 'rgba(91, 157, 255, 0.75)',
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Chunk write (critical)',
          data: [
            [4, 7],
            [3.5, 6.5], // overlaps A's write — race
            [3, 5],
            [6, 8],
          ],
          backgroundColor: [
            'rgba(248, 113, 113, 0.85)',
            'rgba(248, 113, 113, 0.85)',
            'rgba(61, 214, 140, 0.85)',
            'rgba(61, 214, 140, 0.85)',
          ],
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: 'Job windows (seconds) — red = overlapping critical section',
          color: '#e7eef8',
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.raw;
              if (Array.isArray(v)) return `${ctx.dataset.label}: ${v[0]}s → ${v[1]}s`;
              return ctx.formattedValue;
            },
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 10,
          title: { display: true, text: 'Time (s)' },
          grid: { color: 'rgba(36, 48, 65, 0.8)' },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  });

  const note = document.getElementById('timelineNote');
  if (note) {
    note.textContent =
      'Before: Job B overwrites Job A chunks (last writer wins). After: FOR UPDATE lock serializes the critical section — no duplicate work loss.';
  }
}

function initEmbedChart() {
  const ctx = document.getElementById('embedChart');
  if (!ctx) return;

  // Synthetic cosine scores: same-model cluster high, mixed-model drifts low/noisy
  const sameModel = Array.from({ length: 24 }, (_, i) => ({
    x: i + 1,
    y: 0.72 + Math.sin(i / 3) * 0.08 + (i % 5) * 0.01,
  }));
  const mixedModel = Array.from({ length: 24 }, (_, i) => ({
    x: i + 1,
    y: 0.28 + Math.cos(i / 2.2) * 0.18 + ((i * 7) % 4) * 0.02,
  }));

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Same model (3-small ↔ 3-small)',
          data: sameModel,
          backgroundColor: 'rgba(61, 214, 140, 0.85)',
          pointRadius: 5,
        },
        {
          label: 'Mixed model (ada-002 store ↔ 3-small query)',
          data: mixedModel,
          backgroundColor: 'rgba(248, 113, 113, 0.8)',
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: 'Cosine similarity to query — mixed models look “valid” but rank poorly',
          color: '#e7eef8',
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Chunk index' },
          grid: { color: 'rgba(36, 48, 65, 0.8)' },
        },
        y: {
          min: 0,
          max: 1,
          title: { display: true, text: 'Cosine similarity' },
          grid: { color: 'rgba(36, 48, 65, 0.8)' },
        },
      },
    },
  });
}

function initCoverageMatrix() {
  const tbody = document.querySelector('#coverageMatrix tbody');
  if (!tbody) return;

  // After fix: all resolve. "before" column illustrates the three renames.
  const rows = [
    {
      rule: 'qualifying-earnings-uk',
      ids: 'ae-act-2024-s2, ae-act-2024-s10-eligibility',
      was: 'aerssa-2024-interpretation',
      ok: true,
    },
    {
      rule: 'nest-uk-scheme',
      ids: 'ae-act-2024-s10-eligibility',
      was: 'aerssa-2024-eligibility',
      ok: true,
    },
    {
      rule: 'workplace-pension-uk-phrase',
      ids: 'pensions-act-1990-s121-prsa, ae-act-2024-s30-contributions',
      was: 'pensions-1990-prsa-access',
      ok: true,
    },
    {
      rule: 'pension-without-ae-act',
      ids: 'ae-act-2024-s10-eligibility, ae-act-2024-s30-contributions, pensions-act-1990-s121-prsa',
      was: '—',
      ok: true,
    },
    {
      rule: 'working-hours-without-owta',
      ids: 'owta-1997-s15-weekly, owta-1997-s19-annual-leave, owta-1997-s21-public-holiday',
      was: '—',
      ok: true,
    },
    {
      rule: 'notice-without-min-notice-act',
      ids: 'mn-1973-s4-notice, mn-1973-s5-pay-in-lieu',
      was: '—',
      ok: true,
    },
  ];

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <th scope="row">${row.rule}</th>
      <td><code>${row.ids}</code><div style="color:var(--muted);font-size:0.8rem;margin-top:0.25rem">was: <code>${row.was}</code></div></td>
      <td><span class="status-pill ${row.ok ? 'ok' : 'broken'}">${row.ok ? 'resolved' : 'broken'}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

function initMemoryChart() {
  const ctx = document.getElementById('memoryChart');
  if (!ctx) return;

  const cycles = Array.from({ length: 12 }, (_, i) => `Nav ${i + 1}`);
  // Before: linear growth of open subs (leak)
  const before = cycles.map((_, i) => 5 + i * 8);
  // After: flat — takeUntilDestroyed tears down per instance
  const after = cycles.map(() => 2);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: cycles,
      datasets: [
        {
          label: 'Open WS subs (before — leak)',
          data: before,
          borderColor: 'rgba(248, 113, 113, 0.95)',
          backgroundColor: 'rgba(248, 113, 113, 0.15)',
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Open WS subs (after — DestroyRef)',
          data: after,
          borderColor: 'rgba(61, 214, 140, 0.95)',
          backgroundColor: 'rgba(61, 214, 140, 0.12)',
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: 'Subscriptions retained after scrolling a long conversation',
          color: '#e7eef8',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Live subscriptions' },
          grid: { color: 'rgba(36, 48, 65, 0.8)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

function boot() {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js failed to load');
    return;
  }
  initTimelineChart();
  initEmbedChart();
  initCoverageMatrix();
  initMemoryChart();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
