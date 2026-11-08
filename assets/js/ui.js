/* ============================================================
 * ui.js —— 通用 UI 工具：Toast / Modal / 文本与时间格式化
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- Toast ---------- */
  function toast(msg, type, ms) {
    let box = document.querySelector('.toast-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toast-box';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'err' ? 'err' : 'ok');
    el.textContent = msg || '';
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, (ms || 2600) - 300);
    setTimeout(() => el.remove(), ms || 2600);
  }

  /* ---------- Modal ---------- */
  function openModal(opts) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const modal = document.createElement('div');
    modal.className = 'modal';
    if (opts.title) {
      const h = document.createElement('h3');
      h.textContent = opts.title;
      modal.appendChild(h);
    }
    if (opts.sub) {
      const p = document.createElement('p');
      p.className = 'modal-sub';
      p.textContent = opts.sub;
      modal.appendChild(p);
    }
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    modal.appendChild(body);
    const foot = document.createElement('div');
    foot.className = 'modal-foot';
    (opts.buttons || []).forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || 'btn-ghost');
      btn.textContent = b.text || '确定';
      btn.onclick = () => {
        const r = b.onClick ? b.onClick() : undefined;
        if (r !== false) close();
      };
      foot.appendChild(btn);
    });
    modal.appendChild(foot);
    mask.appendChild(modal);
    mask.addEventListener('click', e => { if (e.target === mask && opts.maskClose !== false) close(); });
    document.body.appendChild(mask);
    function close() { mask.remove(); }
    return { el: modal, close };
  }

  /* ---------- 格式化 ---------- */
  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moneyInt(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return '¥' + Number(n).toLocaleString('zh-CN');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function monthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function fmtTime(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 简短“大白话”富文本：**加粗**、换行、• 列表 */
  function renderRich(text) {
    let s = esc(text);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  window.UI = { toast, openModal, money, moneyInt, pad, today, monthKey, fmtTime, esc, renderRich, sleep };
})();
