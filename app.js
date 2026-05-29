/* ═══════════════════════════════════════════
   نظام الطيبات - المنطق الرئيسي
   app.js
   
   ⚠️ ملاحظة: يستخدم هذا الملف Anthropic API
   لتحليل الأطعمة غير الموجودة في قاعدة البيانات.
   يُحتاج إلى proxy server أو بيئة Claude.ai
   لتشغيل استدعاءات الـ API.
═══════════════════════════════════════════ */

// ── Normalize Arabic text for matching ──
function nm(s) {
  return s.toLowerCase().trim()
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ');
}

// ── Search food in local DB ──
function findFood(q) {
  const nq = nm(q);
  if (!nq || nq.length < 2) return [];
  const all = [
    ...DB.allowed.map(f => ({...f, st: 'allowed'})),
    ...DB.forbidden.map(f => ({...f, st: 'forbidden'}))
  ];
  const res = [];
  all.forEach(f => {
    const ns = [f.n, ...(f.a || [])].map(nm);
    const score =
      ns.some(n => n === nq) ? 4 :
      ns.some(n => n.includes(nq) || nq.includes(n)) ? 3 :
      ns.some(n => {
        if (Math.abs(n.length - nq.length) > 4) return false;
        let m = 0;
        for (let i = 0; i < Math.min(n.length, nq.length); i++)
          if (n[i] === nq[i]) m++;
        return m / Math.max(n.length, nq.length) > 0.55;
      }) ? 1 : 0;
    if (score > 0) res.push({...f, score});
  });
  return res.sort((a, b) => b.score - a.score).slice(0, 7);
}

// ── State ──
let searchTimer, currentMatches = [], healthData = [];

// ── Search handler ──
function srch(v) {
  const sg = document.getElementById('sugg');
  clearTimeout(searchTimer);
  if (!v || v.length < 2) { sg.style.display = 'none'; currentMatches = []; return; }
  searchTimer = setTimeout(() => {
    currentMatches = findFood(v);
    if (!currentMatches.length) { sg.style.display = 'none'; return; }
    sg.innerHTML = currentMatches.map((f, i) => `
      <div class="sug-item" onclick="selF(${i})">
        <span style="font-size:1.1rem">${f.st === 'allowed' ? '🟢' : '🔴'}</span>
        <div style="flex:1">
          <div class="sug-name">${f.n}</div>
          <div class="sug-cat">${f.c}</div>
        </div>
        <span class="sug-badge ${f.st}">${f.st === 'allowed' ? 'مسموح' : 'ممنوع'}</span>
      </div>`).join('') +
      `<div class="sug-item sug-ai" onclick="aiSrch(document.getElementById('fi').value)">
        🤖 تحليل بالذكاء الاصطناعي ↗
      </div>`;
    sg.style.display = 'block';
  }, 150);
}

// ── Keyboard handler ──
function kd(e) {
  if (e.key === 'Enter') {
    const v = document.getElementById('fi').value.trim();
    if (!v) return;
    document.getElementById('sugg').style.display = 'none';
    currentMatches.length > 0 ? selF(0) : aiSrch(v);
  }
  if (e.key === 'Escape') document.getElementById('sugg').style.display = 'none';
}

// ── Select from suggestions ──
function selF(i) {
  const f = currentMatches[i];
  document.getElementById('fi').value = f.n;
  document.getElementById('sugg').style.display = 'none';
  showRes(f);
}

// ── Render result card ──
function showRes(f) {
  const ok = f.st === 'allowed';
  const resEl = document.getElementById('fres');
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="result-card ${ok ? 'allowed' : 'forbidden'}">
      <div class="result-header ${ok ? 'allowed' : 'forbidden'}">
        <div class="result-icon">${ok ? '✅' : '🚫'}</div>
        <div style="flex:1">
          <div class="result-name ${ok ? 'allowed' : 'forbidden'}">${f.n}</div>
          <div class="result-badges">
            <span class="badge ${ok ? 'status-allowed' : 'status-forbidden'}">${ok ? '✓ مسموح' : '✗ ممنوع'}</span>
            <span class="badge category">${f.c}</span>
          </div>
        </div>
      </div>
      <div class="result-body">
        <div class="result-section">
          <div class="result-section-label">📌 حكم النظام</div>
          <div class="result-section-text">${f.r}</div>
        </div>
        <div class="result-section">
          <div class="result-logic-box">
            <div class="result-section-label">🧠 التحليل المنطقي</div>
            <div class="result-section-text">${f.lg}</div>
            ${!ok ? '<div class="result-warning">⚕️ ملاحظة: استشر طبيبك قبل اتباع أي نظام غذائي.</div>' : ''}
          </div>
        </div>
        ${f.a && f.a.length ? `<div class="result-aliases">يُعرف أيضاً بـ: ${f.a.slice(0, 4).join('، ')}</div>` : ''}
      </div>
    </div>`;
}

// ── AI System Prompt ──
const AI_SYS = `أنت خبير في نظام الطيبات للدكتور ضياء العوضي.
عند السؤال عن طعام أجب بـJSON فقط بدون نص خارجه:
{"status":"مسموح" أو "ممنوع" أو "مسموح بشروط","reason":"حكم النظام - جملة واحدة","logic":"التحليل المنطقي للقبول أو الرفض - جملتان","category":"الفئة الغذائية"}
المسموح: الأرز، البطاطس، القمح الكامل، اللحوم الحمراء، الكبدة، الأسماك البحرية المشوية، الأرانب، الحمام، زيت الزيتون، السمن، الزبدة، الجبن المطبوخ فقط، التمر، العنب، الموز، التين، العسل، المربى، الشوكولاتة، الشاي، القهوة التركية، خل القصب.
الممنوع: كل الخضروات، الدجاج، البط، الرومي، البيض، الجمبري، السبيط، أسماك المزارع، البقوليات، الدقيق الأبيض، الحليب، الزبادي، الجبن الطبيعي، البطيخ، المانجو، الحمضيات، الغازيات، النسكافيه.`;

// ── AI food analysis (requires API access) ──
async function aiSrch(food) {
  document.getElementById('sugg').style.display = 'none';
  document.getElementById('fres').style.display = 'none';
  document.getElementById('fload').style.display = 'block';
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: AI_SYS,
        messages: [{ role: "user", content: `هل هذا مسموح في نظام الطيبات: ${food}` }]
      })
    });
    const d = await r.json();
    const txt = d.content?.[0]?.text || '{}';
    let p;
    try { p = JSON.parse(txt.replace(/```json|```/g, '').trim()); }
    catch { p = { status: 'غير محدد', reason: 'تعذّر التحليل', logic: '', category: '' }; }
    document.getElementById('fload').style.display = 'none';
    const ok = p.status === 'مسموح';
    const unk = !ok && p.status !== 'ممنوع';
    const cls = unk ? 'partial' : ok ? 'allowed' : 'forbidden';
    document.getElementById('fres').style.display = 'block';
    document.getElementById('fres').innerHTML = `
      <div class="result-card ${cls}">
        <div class="result-header ${cls}">
          <div class="result-icon">${unk ? '⚠️' : ok ? '✅' : '🚫'}</div>
          <div style="flex:1">
            <div class="result-name ${cls}">${food}</div>
            <div class="result-badges">
              <span class="badge status-${cls}">🤖 ${p.status}</span>
              ${p.category ? `<span class="badge category">${p.category}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="result-body">
          <div class="result-section">
            <div class="result-section-label">📌 حكم النظام</div>
            <div class="result-section-text">${p.reason}</div>
          </div>
          ${p.logic ? `
          <div class="result-section">
            <div class="result-logic-box">
              <div class="result-section-label">🧠 التحليل المنطقي</div>
              <div class="result-section-text">${p.logic}</div>
            </div>
          </div>` : ''}
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('fload').style.display = 'none';
    document.getElementById('fres').style.display = 'block';
    document.getElementById('fres').innerHTML =
      `<div style="padding:1rem;background:#fde8e8;border-radius:10px;color:#7f1d1d;font-size:14px;direction:rtl;">❌ تعذّر الاتصال بالذكاء الاصطناعي. تأكد من الاتصال بالإنترنت وأن الملف يعمل عبر بيئة Claude.</div>`;
  }
}

// ── Tab switching ──
function tab(n) {
  document.getElementById('pn1').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('pn2').style.display = n === 2 ? 'block' : 'none';
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
  if (n === 2) renderH();
}

// ── Build category buttons ──
function buildCategories() {
  const allCats = [...new Set([...DB.allowed, ...DB.forbidden].map(f => f.c))];
  const catEl = document.getElementById('cats');
  allCats.forEach(c => {
    const ok = DB.allowed.some(f => f.c === c);
    const btn = document.createElement('button');
    btn.className = `cat-btn ${ok ? 'allowed' : 'forbidden'}`;
    btn.textContent = c;
    btn.onclick = () => {
      const items = [
        ...DB.allowed.filter(f => f.c === c).map(f => ({...f, st: 'allowed'})),
        ...DB.forbidden.filter(f => f.c === c).map(f => ({...f, st: 'forbidden'}))
      ];
      if (items.length) { currentMatches = items; selF(0); document.getElementById('fi').value = items[0].n; }
    };
    catEl.appendChild(btn);
  });
  document.getElementById('acnt').textContent = DB.allowed.length;
  document.getElementById('fcnt').textContent = DB.forbidden.length;
}

// ═══════════════════════════════════════════
// HEALTH TRACKING
// ═══════════════════════════════════════════

// ── Load health data (localStorage for standalone use) ──
function loadH() {
  try {
    const saved = localStorage.getItem('tayyibat_health');
    healthData = saved ? JSON.parse(saved) : [];
  } catch (e) { healthData = []; }
  renderH();
}

function saveH() {
  try { localStorage.setItem('tayyibat_health', JSON.stringify(healthData)); }
  catch (e) { console.warn('Storage unavailable'); }
}

// ── Blood pressure status ──
function bpSt(s, d) {
  if (!s || !d) return null;
  if (s < 120 && d < 80) return { l: 'طبيعي', cls: 'ok' };
  if (s < 130 && d < 80) return { l: 'مرتفع قليلاً', cls: 'warn' };
  if (s < 140 || d < 90) return { l: 'ضغط مرتفع م.1', cls: 'warn' };
  return { l: 'ضغط مرتفع م.2', cls: 'bad' };
}

// ── Blood sugar status ──
function sgSt(v) {
  if (!v) return null;
  if (v < 70) return { l: 'منخفض', cls: 'bad' };
  if (v < 100) return { l: 'طبيعي', cls: 'ok' };
  if (v < 126) return { l: 'ما قبل السكري', cls: 'warn' };
  return { l: 'مرتفع', cls: 'bad' };
}

// ── Add new record ──
function addR() {
  const bp = document.getElementById('bpIn').value.trim();
  const sg = document.getElementById('sgIn').value.trim();
  const note = document.getElementById('noteIn').value.trim();
  if (!bp && !sg) { alert('أدخل ضغط الدم أو السكر على الأقل'); return; }
  let bs = null, bd = null;
  if (bp) {
    const pts = bp.split('/');
    if (pts.length !== 2 || isNaN(parseInt(pts[0]))) { alert('صيغة الضغط: 120/80'); return; }
    bs = parseInt(pts[0]); bd = parseInt(pts[1]);
  }
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    bs, bd, sg: sg ? parseInt(sg) : null, note
  };
  healthData.unshift(entry);
  saveH();
  document.getElementById('bpIn').value = '';
  document.getElementById('sgIn').value = '';
  document.getElementById('noteIn').value = '';
  renderH();
}

// ── Delete record ──
function delR(id) {
  healthData = healthData.filter(r => r.id !== id);
  saveH();
  renderH();
}

// ── Render health panel ──
function renderH() {
  const sumEl = document.getElementById('hSum');
  const chEl = document.getElementById('hChart');
  const lstEl = document.getElementById('hList');
  if (!healthData.length) {
    sumEl.innerHTML = '';
    chEl.innerHTML = '';
    lstEl.innerHTML = '<div class="empty-state">لا توجد قياسات بعد. أضف أول قياس أعلاه 👆</div>';
    return;
  }
  const bpE = healthData.filter(r => r.bs);
  const sgE = healthData.filter(r => r.sg);
  const lBP = bpE[0], lSG = sgE[0];

  // Summary cards
  sumEl.innerHTML = `
    ${lBP ? `<div class="summary-card">
      <div class="summary-card-label">آخر ضغط دم</div>
      <div class="summary-card-value" style="direction:ltr">${lBP.bs}/${lBP.bd}</div>
      ${bpSt(lBP.bs, lBP.bd) ? `<span class="badge-sm badge-${bpSt(lBP.bs, lBP.bd).cls}">${bpSt(lBP.bs, lBP.bd).l}</span>` : ''}
    </div>` : `<div class="summary-card"><div class="summary-card-label" style="color:#9ca3af">لا يوجد قياس ضغط</div></div>`}
    ${lSG ? `<div class="summary-card">
      <div class="summary-card-label">آخر سكر الدم</div>
      <div class="summary-card-value">${lSG.sg} <span class="summary-card-unit">mg/dL</span></div>
      ${sgSt(lSG.sg) ? `<span class="badge-sm badge-${sgSt(lSG.sg).cls}">${sgSt(lSG.sg).l}</span>` : ''}
    </div>` : `<div class="summary-card"><div class="summary-card-label" style="color:#9ca3af">لا يوجد قياس سكر</div></div>`}`;

  // Sugar chart
  chEl.innerHTML = '';
  if (sgE.length >= 2) {
    const pts = sgE.slice(0, 8).reverse();
    const mx = Math.max(...pts.map(r => r.sg), 140);
    const barColors = { ok: '#16a34a', warn: '#d97706', bad: '#dc2626' };
    chEl.innerHTML = `<div class="chart-box">
      <div class="chart-title">📈 مخطط سكر الدم</div>
      <div class="chart-bars">
        ${pts.map(r => {
          const h = Math.round((r.sg / mx) * 70);
          const s = sgSt(r.sg);
          return `<div class="chart-bar-wrap">
            <div class="chart-bar-label">${r.sg}</div>
            <div class="chart-bar" style="height:${h}px;background:${s ? barColors[s.cls] : '#9ca3af'}"></div>
          </div>`;
        }).join('')}
      </div>
      <div class="chart-legend">
        <span>🟢 أقل من 100 طبيعي</span>
        <span>🟡 100-125 ما قبل السكري</span>
        <span>🔴 126+ مرتفع</span>
      </div>
    </div>`;
  }

  // Records list
  lstEl.innerHTML = `<p class="records-label">سجل القياسات (${healthData.length})</p>` +
    healthData.map(r => {
      const bp = bpSt(r.bs, r.bd);
      const sg = sgSt(r.sg);
      return `<div class="record-item">
        <div class="record-top">
          <div style="flex:1">
            <div class="record-meta">${r.date} · ${r.time}${r.note ? ' · ' + r.note : ''}</div>
            <div class="record-vals">
              ${r.bs ? `<div class="record-val">
                <span>❤️</span>
                <span class="record-num">${r.bs}/${r.bd}</span>
                ${bp ? `<span class="badge-sm badge-${bp.cls}">${bp.l}</span>` : ''}
              </div>` : ''}
              ${r.sg ? `<div class="record-val">
                <span>🩸</span>
                <span class="record-num">${r.sg} mg</span>
                ${sg ? `<span class="badge-sm badge-${sg.cls}">${sg.l}</span>` : ''}
              </div>` : ''}
            </div>
          </div>
          <button class="del-btn" onclick="delR(${r.id})" title="حذف">×</button>
        </div>
      </div>`;
    }).join('');
}

// ── Close suggestions on outside click ──
document.addEventListener('click', e => {
  if (!e.target.closest('#sugg') && !e.target.closest('#fi'))
    document.getElementById('sugg').style.display = 'none';
});

// ── Init ──
buildCategories();
loadH();
