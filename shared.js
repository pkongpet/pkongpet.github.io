/* ============================================================
 * shared.js — utilities used by every page in the site.
 *
 *   • Year footer
 *   • Active nav-link highlight
 *   • Generic slider binding + bidirectional number-input sync
 *     (so every range slider becomes typeable)
 *   • Scientific-notation helpers (mantissa+exponent)
 *   • Prefactor widget (Bd ↔ Bd*, MPa ↔ Pa) used in Section 2 & 4
 * ============================================================ */

/* ---- footer year ---- */
(function() {
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();

/* ---- active nav-link highlighting ---- */
(function() {
  function currentPage() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function currentSection(page) {
    if (page !== 'index.html') return '';
    return (location.hash || '#about').toLowerCase();
  }

  function updateActiveNav() {
    const here = currentPage();
    const section = currentSection(here);
    document.querySelectorAll('nav .nav-links a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const url = new URL(href, location.href);
      const targetPage = (url.pathname.split('/').pop() || 'index.html').toLowerCase();
      const targetHash = url.hash.toLowerCase();
      const isSamePage = targetPage === here;
      const isActiveSection = here === 'index.html' && targetHash && targetHash === section;
      const isActivePage = isSamePage && !targetHash && (here !== 'index.html' || section === '#about');
      a.classList.toggle('active', isActiveSection || isActivePage);
    });
  }

  updateActiveNav();
  window.addEventListener('hashchange', updateActiveNav);
})();

/* ---- generic helper to bind a list of slider IDs to a handler ---- */
function bindSliders(ids, handler) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', handler);
  });
}

/* ---- numeric helpers ---- */
function _isFiniteNum(v) { return Number.isFinite(v); }

/* Read a sci-input pair (mantissa slider/input + exponent input) */
function _sciVal(mantId, expId) {
  const numEl = document.getElementById(mantId + '-num');
  let m = numEl ? +numEl.value : +document.getElementById(mantId).value;
  let e = +document.getElementById(expId).value;
  if (!Number.isFinite(m)) m = +document.getElementById(mantId).value;
  if (!Number.isFinite(e)) e = 0;
  return { val: m * Math.pow(10, e), mant: m, exp: e };
}

/* Format mantissa+exp as "M × 10ᴱ" with Unicode superscripts */
function _sciFmt(mant, exp) {
  const supMap = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³',
                   '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const supStr = String(exp).split('').map(c => supMap[c] || c).join('');
  const mStr = (Math.abs(mant) < 10 ? mant.toFixed(2) : mant.toFixed(1)).replace(/\.?0+$/, '');
  return mStr + ' × 10' + supStr;
}

/* Format any scalar as "M×10ᴱ" */
function _formatSci(v) {
  if (!Number.isFinite(v) || v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / Math.pow(10, exp);
  const supMap = { '-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
  const supStr = String(exp).split('').map(c => supMap[c] || c).join('');
  return mant.toFixed(2).replace(/\.?0+$/, '') + '×10' + supStr;
}

/* ============================================================
 * Editable slider values: convert every "<span class='val' id='X-val'>"
 * into a typeable number input bound bidirectionally to slider id "X".
 * For sci-input rows, also adds a typeable mantissa number input.
 * ============================================================ */
function _bindPair(input, slider) {
  let _typing = false;
  input.addEventListener('input', () => {
    const v = +input.value;
    if (!_isFiniteNum(v)) return;
    const minV = +slider.min, maxV = +slider.max;
    _typing = true;
    slider.value = Math.min(maxV, Math.max(minV, v));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    _typing = false;
  });
  slider.addEventListener('input', () => {
    if (_typing) return;
    input.value = slider.value;
  });
}

function makeValEditable() {
  document.querySelectorAll('span.val').forEach(span => {
    const id = span.id;
    if (!id || !id.endsWith('-val')) return;
    const sliderId = id.slice(0, -4);
    const slider = document.getElementById(sliderId);
    if (!slider || slider.tagName !== 'INPUT' || slider.type !== 'range') return;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'val-input';
    input.id = id;
    if (slider.min  !== '') input.min  = slider.min;
    if (slider.max  !== '') input.max  = slider.max;
    if (slider.step !== '') input.step = slider.step;
    input.value = slider.value;
    span.replaceWith(input);
    _bindPair(input, slider);
  });

  document.querySelectorAll('.sci-input').forEach(row => {
    const slider = row.querySelector('input[type="range"]');
    if (!slider) return;
    if (row.querySelector('input.val-input.sci-mant-num')) return;
    const num = document.createElement('input');
    num.type = 'number';
    num.className = 'val-input sci-mant-num';
    num.id = slider.id + '-num';
    if (slider.min !== '') num.min = slider.min;
    if (slider.max !== '') num.max = slider.max;
    num.step = 'any';
    num.value = slider.value;
    slider.insertAdjacentElement('afterend', num);
    _bindPair(num, slider);
  });
}

/* ============================================================
 * Prefactor widget — Bd / Bd* in MPa or Pa.
 * Reads (mantissa, exp, unit-dropdown) and returns absolute B*
 * in Pa^-n s^-1. Updates the conversion display below the input.
 * ============================================================ */
function _readPrefactor(prefix, n_exp, C_OH, rOH, d0_um, p_exp) {
  const numEl = document.getElementById(prefix + '-mant-num');
  const mant = numEl ? +numEl.value : +document.getElementById(prefix + '-mant').value;
  const exp  = +document.getElementById(prefix + '-exp').value;
  const v    = mant * Math.pow(10, exp);
  const sel  = document.getElementById(prefix + '-unit');
  const unit = sel ? sel.value : 'B_MPa';
  const MPa_n  = Math.pow(1e6, n_exp);
  const enrich = Math.pow(C_OH, rOH) * (p_exp > 0 ? Math.pow(d0_um, -p_exp) : 1);
  switch (unit) {
    case 'B_MPa':  return (v / MPa_n) * enrich;
    case 'B_Pa':   return v * enrich;
    case 'Bs_MPa': return v / MPa_n;
    case 'Bs_Pa':  return v;
    default:       return v;
  }
}

function _updatePrefDisplay(prefix, varName, n_exp, C_OH, rOH, d0_um, p_exp) {
  const conv = document.getElementById(prefix + '-conv');
  if (!conv) return;
  const Bs_Pa = _readPrefactor(prefix, n_exp, C_OH, rOH, d0_um, p_exp);
  const MPa_n = Math.pow(1e6, n_exp);
  const enrich = Math.pow(C_OH, rOH) * (p_exp > 0 ? Math.pow(d0_um, -p_exp) : 1);
  const B_Pa  = Bs_Pa / enrich;
  const B_MPa = B_Pa * MPa_n;
  const Bs_MPa = Bs_Pa * MPa_n;
  const supN = n_exp === 1 ? '¹' : 'ⁿ';
  conv.innerHTML =
    `${varName} = ${_formatSci(B_MPa)} MPa⁻${supN}·s⁻¹` +
    ` = ${_formatSci(B_Pa)} Pa⁻${supN}·s⁻¹` +
    ` &nbsp;|&nbsp; ${varName}<sup>*</sup> = ${_formatSci(Bs_MPa)} MPa⁻${supN}·s⁻¹` +
    ` = ${_formatSci(Bs_Pa)} Pa⁻${supN}·s⁻¹`;
}

/* When the user changes the unit dropdown, rewrite mantissa/exp so
 * the physical B* is preserved across the unit switch. */
const _prefOldUnit = {};
function _bindPrefUnit(prefix, getN, getEnrich, triggerUpdate) {
  const sel = document.getElementById(prefix + '-unit');
  if (!sel) return;
  _prefOldUnit[prefix] = sel.value;
  sel.addEventListener('change', () => {
    const oldUnit = _prefOldUnit[prefix];
    const newUnit = sel.value;
    const numEl = document.getElementById(prefix + '-mant-num');
    const mantSlider = document.getElementById(prefix + '-mant');
    const expEl = document.getElementById(prefix + '-exp');
    const mant = numEl ? +numEl.value : +mantSlider.value;
    const exp  = +expEl.value;
    const v    = mant * Math.pow(10, exp);
    const n_exp  = getN();
    const enrich = getEnrich();
    const MPa_n  = Math.pow(1e6, n_exp);
    let Bs;
    switch (oldUnit) {
      case 'B_MPa':  Bs = (v / MPa_n) * enrich; break;
      case 'B_Pa':   Bs = v * enrich; break;
      case 'Bs_MPa': Bs = v / MPa_n; break;
      case 'Bs_Pa':  Bs = v; break;
      default:       Bs = v;
    }
    let newV;
    switch (newUnit) {
      case 'B_MPa':  newV = (Bs / enrich) * MPa_n; break;
      case 'B_Pa':   newV = Bs / enrich; break;
      case 'Bs_MPa': newV = Bs * MPa_n; break;
      case 'Bs_Pa':  newV = Bs; break;
      default:       newV = Bs;
    }
    if (newV > 0 && Number.isFinite(newV)) {
      const newExp  = Math.floor(Math.log10(newV));
      const newMant = newV / Math.pow(10, newExp);
      expEl.value = newExp;
      if (mantSlider) mantSlider.value = Math.min(9.9, Math.max(1, newMant));
      if (numEl) numEl.value = +newMant.toFixed(4);
    }
    _prefOldUnit[prefix] = newUnit;
    triggerUpdate();
  });
}

/* ---- physical constants & Plotly defaults ---- */
const SECONDS_PER_MYR = 1e6 * 365.25 * 24 * 3600;
const R_GAS = 8.314;

const baseLayout = {
  margin: { l: 60, r: 20, t: 30, b: 50 },
  paper_bgcolor: '#ffffff',
  plot_bgcolor: '#ffffff',
  font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#1c2128' },
  hovermode: 'closest',
  showlegend: true,
  legend: { x: 0.98, y: 0.98, xanchor: 'right', yanchor: 'top',
            bgcolor: 'rgba(255,255,255,0.85)', bordercolor: '#e5e1d8', borderwidth: 1 }
};
const config = { displayModeBar: false, responsive: true };

/* Numerical erf (Abramowitz & Stegun 7.1.26) */
function erf(x) {
  const sign = Math.sign(x);
  x = Math.abs(x);
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const t  = 1.0 / (1.0 + p * x);
  const y  = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
  return sign * y;
}
