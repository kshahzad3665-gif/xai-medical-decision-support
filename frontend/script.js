// ════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════════════════════
const API_BASE = 'http://localhost:5000';

const DIABETES_IDS = [
  'd-pregnancies','d-glucose','d-bloodpressure','d-skinthickness',
  'd-insulin','d-bmi','d-pedigree','d-age'
];
const DIABETES_KEYS = [
  'Pregnancies','Glucose','BloodPressure','SkinThickness',
  'Insulin','BMI','DiabetesPedigreeFunction','Age'
];
const HEART_IDS = [
  'h-age','h-sex','h-cp','h-trestbps','h-chol','h-fbs',
  'h-restecg','h-thalach','h-exang','h-oldpeak','h-slope','h-ca','h-thal'
];
const HEART_KEYS = [
  'Age','Sex','ChestPainType','RestingBP','Cholesterol','FastingBS',
  'RestingECG','MaxHR','ExerciseAngina','Oldpeak','Slope','CA','Thal'
];

// Stored API responses for PDP updates
const lastResponse = { diabetes: null, heart: null };
const historyLog   = { diabetes: [], heart: [] };

// ════════════════════════════════════════════════════════════════════════════
//  TAB SWITCHING
// ════════════════════════════════════════════════════════════════════════════
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  btn.classList.add('active');
}

// ════════════════════════════════════════════════════════════════════════════
//  FORM HELPERS
// ════════════════════════════════════════════════════════════════════════════
function collectInputs(ids, keys) {
  const data = {};
  let valid = true;
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    const v = el.value.trim();
    if (v === '' || isNaN(parseFloat(v))) {
      el.classList.add('error');
      valid = false;
    } else {
      el.classList.remove('error');
      data[keys[i]] = parseFloat(v);
    }
  });
  return valid ? data : null;
}

function clearForm(type) {
  const ids = type === 'diabetes' ? DIABETES_IDS : HEART_IDS;
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('error');
  });
  // Reset panels
  document.getElementById(`pred-empty-${type}`).style.display = '';
  document.getElementById(`pred-result-${type}`).classList.remove('show');
  document.getElementById(`shap-empty-${type}`).style.display = '';
  document.getElementById(`shap-chart-${type}`).style.display = 'none';
  document.getElementById(`pdp-empty-${type}`).style.display = '';
  document.getElementById(`pdp-chart-${type}`).style.display = 'none';
  d3.select(`#shap-chart-${type}`).selectAll('*').remove();
  d3.select(`#pdp-chart-${type}`).selectAll('*').remove();
  lastResponse[type] = null;
}

// ════════════════════════════════════════════════════════════════════════════
//  PREDICTION CALL
// ════════════════════════════════════════════════════════════════════════════
async function predict(type) {
  const ids  = type === 'diabetes' ? DIABETES_IDS  : HEART_IDS;
  const keys = type === 'diabetes' ? DIABETES_KEYS : HEART_KEYS;
  const data = collectInputs(ids, keys);
  if (!data) { showToast('Please fill all fields with valid numbers.', 'error'); return; }

  // Loading state
  const btn     = document.getElementById(`btn-${type}`);
  const spinner = document.getElementById(`spinner-${type}`);
  const btnTxt  = document.getElementById(`btn-${type}-text`);
  btn.disabled = true;
  spinner.style.display = 'block';
  btnTxt.textContent = 'Analysing…';

  try {
    const res  = await fetch(`${API_BASE}/predict/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);

    lastResponse[type] = json;
    renderPrediction(type, json);
    renderSHAP(type, json);
    addHistory(type, json, data);
    showToast('Prediction complete ✓', 'ok');

    // Auto-select first feature for PDP
    const sel = document.getElementById(`pdp-select-${type}`);
    if (sel.value === '') sel.selectedIndex = 1;
    updatePDP(type);

  } catch (err) {
    showToast(err.message || 'Connection error — is Flask running?', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    btnTxt.textContent = '🔍 Run Prediction';
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDER PREDICTION
// ════════════════════════════════════════════════════════════════════════════
function renderPrediction(type, data) {
  const prob    = data.probability;
  const isPos   = data.prediction === 1;
  const label   = type === 'diabetes'
    ? (isPos ? 'Diabetic' : 'Non-Diabetic')
    : (isPos ? 'Heart Disease Detected' : 'No Heart Disease');
  const risk    = prob < 0.35 ? 'Low' : prob < 0.65 ? 'Moderate' : 'High';
  const riskCol = prob < 0.35 ? 'var(--green)' : prob < 0.65 ? 'var(--amber)' : 'var(--red)';

  document.getElementById(`pred-empty-${type}`).style.display = 'none';
  const result = document.getElementById(`pred-result-${type}`);
  result.classList.add('show');

  const verdict  = document.getElementById(`verdict-${type}`);
  verdict.className = `result-verdict ${isPos ? 'positive' : 'negative'}`;
  document.getElementById(`verdict-icon-${type}`).textContent = isPos ? '⚠️' : '✅';
  document.getElementById(`verdict-text-${type}`).textContent = label;

  document.getElementById(`prob-val-${type}`).textContent = `${(prob * 100).toFixed(1)}%`;
  const riskEl = document.getElementById(`risk-val-${type}`);
  riskEl.textContent = risk;
  riskEl.style.color = riskCol;

  drawGauge(type, prob);
}

// ════════════════════════════════════════════════════════════════════════════
//  D3 GAUGE CHART
// ════════════════════════════════════════════════════════════════════════════
function drawGauge(type, prob) {
  const svgEl = document.getElementById(`gauge-${type}`);
  const svg   = d3.select(svgEl);
  svg.selectAll('*').remove();

  const w = 200, h = 120, cx = 100, cy = 110, r = 88;
  const startAngle = -Math.PI, endAngle = 0;
  const arc  = d3.arc().innerRadius(r - 22).outerRadius(r).startAngle(startAngle);
  const bg   = d3.arc().innerRadius(r - 22).outerRadius(r).startAngle(startAngle).endAngle(endAngle);
  const g    = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  // Track background
  g.append('path').datum({ endAngle }).attr('d', bg).attr('fill', '#e2e8f0');

  // Gradient defs
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', `gauge-grad-${type}`)
    .attr('gradientUnits', 'userSpaceOnUse').attr('x1', -r).attr('y1', 0).attr('x2', r).attr('y2', 0);
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#059669');
  grad.append('stop').attr('offset', '50%').attr('stop-color', '#d97706');
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#dc2626');

  // Animated fill arc
  const fillArc = g.append('path')
    .datum({ endAngle: startAngle })
    .attr('d', arc)
    .attr('fill', `url(#gauge-grad-${type})`);

  const targetAngle = startAngle + (endAngle - startAngle) * prob;
  fillArc.transition()
    .duration(900)
    .ease(d3.easeCubicOut)
    .attrTween('d', function(d) {
      const interpolate = d3.interpolate(d.endAngle, targetAngle);
      return function(t) {
        d.endAngle = interpolate(t);
        return arc(d);
      };
    });

  // Needle
  const needleAngle = startAngle + (endAngle - startAngle) * prob;
  const needle = g.append('line')
    .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', -(r - 11))
    .attr('stroke', '#1e293b').attr('stroke-width', 2.5).attr('stroke-linecap', 'round')
    .attr('transform', `rotate(${startAngle * 180 / Math.PI})`);
  needle.transition().duration(900).ease(d3.easeCubicOut)
    .attr('transform', `rotate(${needleAngle * 180 / Math.PI})`);

  // Centre circle
  g.append('circle').attr('r', 6).attr('fill', '#1e293b');

  // Probability text
  const pct = g.append('text').attr('text-anchor', 'middle').attr('y', -28)
    .attr('font-family', "'Syne',sans-serif").attr('font-size', '22').attr('font-weight', '800')
    .attr('fill', '#0f172a').text('0%');
  d3.transition().duration(900).ease(d3.easeCubicOut)
    .tween('text', () => {
      const i = d3.interpolateNumber(0, prob * 100);
      return t => pct.text(`${i(t).toFixed(1)}%`);
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  D3 SHAP HORIZONTAL BAR CHART
// ════════════════════════════════════════════════════════════════════════════
function renderSHAP(type, data) {
  const container = document.getElementById(`shap-chart-${type}`);
  const emptyEl   = document.getElementById(`shap-empty-${type}`);
  d3.select(container).selectAll('*').remove();

  const features = data.feature_names;
  const values   = data.shap_values;

  const pairs = features.map((f, i) => ({ name: f, val: values[i] }))
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

  const margin = { top: 10, right: 70, bottom: 30, left: 155 };
  const width  = container.clientWidth || 420;
  const height = Math.max(220, pairs.length * 32 + margin.top + margin.bottom);
  const iW = width - margin.left - margin.right;
  const iH = height - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const maxAbs = Math.max(d3.max(pairs, d => Math.abs(d.val)), 0.001);
  const x = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, iW]);
  const y = d3.scaleBand().domain(pairs.map(d => d.name)).range([0, iH]).padding(0.25);

  // Grid lines
  g.append('g').attr('class', 'grid')
    .call(d3.axisBottom(x).ticks(5).tickSize(iH).tickFormat(''))
    .call(gg => { gg.selectAll('.domain').remove(); gg.selectAll('line').attr('stroke', '#e2e8f0'); });

  // Zero line
  g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', iH)
    .attr('stroke', '#94a3b8').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3');

  const tooltip = document.getElementById('d3-tooltip');

  // Bars
  g.selectAll('.shap-bar').data(pairs).join('rect')
    .attr('class', 'shap-bar')
    .attr('y', d => y(d.name))
    .attr('height', y.bandwidth())
    .attr('fill', d => d.val >= 0 ? '#ef4444' : '#3b82f6')
    .attr('opacity', .85)
    .attr('rx', 3)
    .attr('x', d => d.val >= 0 ? x(0) : x(d.val))
    .attr('width', 0)
    .on('mousemove', (event, d) => {
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top  = `${event.clientY - 28}px`;
      tooltip.innerHTML = `<b>${d.name}</b>: ${d.val >= 0 ? '+' : ''}${d.val.toFixed(4)}`;
    })
    .on('mouseleave', () => { tooltip.style.opacity = '0'; })
    .transition().duration(700).ease(d3.easeCubicOut)
    .attr('width', d => Math.abs(x(d.val) - x(0)));

  // Value labels
  g.selectAll('.shap-label').data(pairs).join('text')
    .attr('class', 'shap-label')
    .attr('y', d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('fill', d => d.val >= 0 ? '#dc2626' : '#2563eb')
    .attr('font-size', '11').attr('font-family', "'DM Sans',sans-serif").attr('font-weight', '600')
    .attr('x', d => d.val >= 0 ? x(d.val) + 5 : x(d.val) - 5)
    .attr('text-anchor', d => d.val >= 0 ? 'start' : 'end')
    .attr('opacity', 0)
    .text(d => `${d.val >= 0 ? '+' : ''}${d.val.toFixed(3)}`)
    .transition().delay(700).duration(300).attr('opacity', 1);

  // Feature labels
  g.selectAll('.feat-label').data(pairs).join('text')
    .attr('class', 'feat-label')
    .attr('x', -8).attr('y', d => y(d.name) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', '12').attr('font-family', "'DM Sans',sans-serif").attr('fill', '#475569')
    .text(d => d.name);

  // X Axis
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d.toFixed(2)))
    .call(gg => { gg.select('.domain').attr('stroke', '#e2e8f0'); gg.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10'); });

  // Legend
  const leg = g.append('g').attr('transform', `translate(0,${iH + 22})`);
  [['#ef4444', '↑ Increases Risk'], ['#3b82f6', '↓ Decreases Risk']].forEach(([c, t], i) => {
    leg.append('rect').attr('x', i * 140).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', c).attr('rx', 2);
    leg.append('text').attr('x', i * 140 + 14).attr('y', 9).attr('fill', '#64748b').attr('font-size', '10').attr('font-family', "'DM Sans',sans-serif").text(t);
  });

  emptyEl.style.display = 'none';
  container.style.display = 'block';
}

// ════════════════════════════════════════════════════════════════════════════
//  D3 PDP LINE CHART
// ════════════════════════════════════════════════════════════════════════════
function updatePDP(type) {
  const data = lastResponse[type];
  if (!data) { showToast('Run a prediction first.', 'error'); return; }

  const sel     = document.getElementById(`pdp-select-${type}`);
  const feature = sel.value;
  if (!feature || !data.pdp_data[feature]) return;

  const pdp       = data.pdp_data[feature];
  const container = document.getElementById(`pdp-chart-${type}`);
  d3.select(container).selectAll('*').remove();

  const margin = { top: 20, right: 30, bottom: 45, left: 55 };
  const width  = container.clientWidth || 700;
  const height = 230;
  const iW = width - margin.left - margin.right;
  const iH = height - margin.top - margin.bottom;

  const svg = d3.select(container).append('svg')
    .attr('width', '100%').attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain(d3.extent(pdp.x)).range([0, iW]);
  const y = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

  // Gradient fill area
  const defs = svg.append('defs');
  const areaGrad = defs.append('linearGradient').attr('id', `area-grad-${type}`).attr('gradientUnits', 'userSpaceOnUse').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', iH);
  areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6').attr('stop-opacity', .25);
  areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', .01);

  const area = d3.area().x((d, i) => x(pdp.x[i])).y0(iH).y1((d, i) => y(pdp.y[i])).curve(d3.curveCatmullRom);
  const line = d3.line().x((d, i) => x(pdp.x[i])).y((d, i) => y(pdp.y[i])).curve(d3.curveCatmullRom);

  // Grid
  g.append('g').call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(''))
    .call(gg => { gg.selectAll('.domain').remove(); gg.selectAll('line').attr('stroke', '#f1f5f9'); });

  // Area fill
  g.append('path').datum(pdp.y).attr('d', area).attr('fill', `url(#area-grad-${type})`);

  // Animated line
  const path = g.append('path').datum(pdp.y).attr('d', line)
    .attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2.5).attr('stroke-linecap', 'round');
  const pathLen = path.node().getTotalLength();
  path.attr('stroke-dasharray', pathLen).attr('stroke-dashoffset', pathLen)
    .transition().duration(800).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

  // Hover line + dot
  const focusLine = g.append('line').attr('y1', 0).attr('y2', iH)
    .attr('stroke', '#94a3b8').attr('stroke-dasharray', '4,3').attr('stroke-width', 1.5).attr('opacity', 0);
  const focusDot = g.append('circle').attr('r', 5).attr('fill', '#2563eb').attr('stroke', '#fff').attr('stroke-width', 2).attr('opacity', 0);
  const tooltip  = document.getElementById('d3-tooltip');

  g.append('rect').attr('width', iW).attr('height', iH).attr('fill', 'none').attr('pointer-events', 'all')
    .on('mousemove', function(event) {
      const [mx] = d3.pointer(event);
      const xVal = x.invert(mx);
      const bi   = d3.bisectLeft(pdp.x, xVal);
      const i    = Math.min(bi, pdp.x.length - 1);
      const cx   = x(pdp.x[i]), cy = y(pdp.y[i]);
      focusLine.attr('x1', cx).attr('x2', cx).attr('opacity', 1);
      focusDot.attr('cx', cx).attr('cy', cy).attr('opacity', 1);
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top  = `${event.clientY - 28}px`;
      tooltip.innerHTML  = `<b>${feature}</b>: ${pdp.x[i].toFixed(2)} → Prob: ${(pdp.y[i] * 100).toFixed(1)}%`;
    })
    .on('mouseleave', () => {
      focusLine.attr('opacity', 0); focusDot.attr('opacity', 0); tooltip.style.opacity = '0';
    });

  // Axes
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(6))
    .call(gg => { gg.select('.domain').attr('stroke', '#e2e8f0'); gg.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '11'); });
  g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(d*100).toFixed(0)}%`))
    .call(gg => { gg.select('.domain').attr('stroke', '#e2e8f0'); gg.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '11'); });

  // Labels
  g.append('text').attr('x', iW / 2).attr('y', iH + 38).attr('text-anchor', 'middle')
    .attr('font-size', '12').attr('fill', '#64748b').attr('font-family', "'DM Sans',sans-serif").text(feature);
  g.append('text').attr('transform', 'rotate(-90)').attr('x', -iH / 2).attr('y', -42).attr('text-anchor', 'middle')
    .attr('font-size', '12').attr('fill', '#64748b').attr('font-family', "'DM Sans',sans-serif").text('Predicted Probability');

  document.getElementById(`pdp-empty-${type}`).style.display = 'none';
  container.style.display = 'block';
}

// ════════════════════════════════════════════════════════════════════════════
//  HISTORY
// ════════════════════════════════════════════════════════════════════════════
function addHistory(type, data, inputs) {
  const ts  = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const isP = data.prediction === 1;
  const label = type === 'diabetes'
    ? (isP ? 'Diabetic' : 'Non-Diabetic')
    : (isP ? 'Heart+' : 'Heart–');

  historyLog[type].unshift({ ts, label, isP, prob: data.probability, data, inputs });
  if (historyLog[type].length > 8) historyLog[type].pop();

  const list = document.getElementById(`history-${type}`);
  list.innerHTML = '';
  historyLog[type].forEach(h => {
    const chip = document.createElement('div');
    chip.className = 'history-chip';
    chip.innerHTML = `<div class="chip-dot ${h.isP ? 'pos' : 'neg'}"></div>
      <span>${h.ts}</span><span>·</span><span style="font-weight:600">${h.label}</span>
      <span style="color:var(--text-3)">${(h.prob*100).toFixed(0)}%</span>`;
    chip.title = 'Click to restore';
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', () => {
      // Restore inputs
      const ids  = type === 'diabetes' ? DIABETES_IDS  : HEART_IDS;
      const keys = type === 'diabetes' ? DIABETES_KEYS : HEART_KEYS;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.value = h.inputs[keys[i]] ?? '';
      });
      // Restore results
      lastResponse[type] = h.data;
      renderPrediction(type, h.data);
      renderSHAP(type, h.data);
      showToast('Restored from history', 'ok');
    });
    list.appendChild(chip);
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  REPORT DOWNLOAD (plain text summary)
// ════════════════════════════════════════════════════════════════════════════
function downloadReport() {
  const lines = ['XAI HEALTHCARE DASHBOARD — SESSION REPORT', '='.repeat(50), `Generated: ${new Date().toLocaleString()}`, ''];

  ['diabetes', 'heart'].forEach(type => {
    if (historyLog[type].length === 0) return;
    lines.push(`\n── ${type.toUpperCase()} PREDICTIONS ──`);
    historyLog[type].forEach((h, i) => {
      lines.push(`\n[${i+1}] Time: ${h.ts}`);
      lines.push(`  Prediction: ${h.label}  |  Probability: ${(h.prob*100).toFixed(1)}%`);
      lines.push('  SHAP Feature Contributions:');
      h.data.feature_names.forEach((f, j) => {
        const v = h.data.shap_values[j];
        lines.push(`    ${f.padEnd(28)} ${v >= 0 ? '+' : ''}${v.toFixed(4)}`);
      });
    });
  });

  if (lines.length <= 4) { showToast('No predictions to export yet.', 'error'); return; }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `xai_report_${Date.now()}.txt`;
  a.click();
  showToast('Report downloaded ✓', 'ok');
}

// ════════════════════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = 'ok') {
  clearTimeout(toastTimer);
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-icon').textContent = type === 'error' ? '⚠️' : '✅';
  el.className = `toast ${type === 'error' ? 'error' : ''} show`;
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ════════════════════════════════════════════════════════════════════════════
//  INIT — check backend connection
// ════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error();
    document.querySelector('.badge-dot').style.background = 'var(--green)';
  } catch {
    document.querySelector('.header-badge').style.background = '#fef2f2';
    document.querySelector('.header-badge').style.color = 'var(--red)';
    document.querySelector('.header-badge').style.borderColor = '#fecaca';
    document.querySelector('.header-badge').innerHTML = '<span style="color:var(--red)">⚠ API Offline</span>';
    showToast('Flask API not reachable — start the backend first.', 'error');
  }
})();