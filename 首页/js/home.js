/* ============================================================
 * home.js —— 首页逻辑：硬件分类卡片 / 搜索 / AI 入口
 * ============================================================ */
(function () {
  'use strict';

  /* 类型 → 页面文件夹与文件名（与前端目录结构一致） */
  var TYPE_PAGE = {
    cpu: { folder: 'CPU', file: 'cpu.html' },
    gpu: { folder: 'GPU', file: 'gpu.html' },
    mem_desktop: { folder: '台式机内存', file: 'neichun pc.html' },
    mem_laptop: { folder: '笔记本内存', file: 'neichun bookpc.html' },
    ssd: { folder: '固态硬盘', file: 'gutai.html' },
    ssd_usb: { folder: '移动便携固态硬盘', file: 'yidong gutaiyingpan.html' },
    hdd_usb: { folder: '移动便携机械硬盘', file: 'yidong jixieyingpan.html' },
    monitor: { folder: '显示屏', file: 'xianshiping.html' },
    keyboard: { folder: '键盘', file: 'jianpan.html' },
    mouse: { folder: '鼠标', file: 'shubiao.html' },
  };

  /* 分类图标（24 视图框线条图标） */
  var ICONS = {
    cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M5 10H2M5 14H2M22 10h-3M22 14h-3M10 5V2M14 5V2M10 22v-3M14 22v-3M9 2v3M15 2v3"/></svg>',
    gpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="9.5" cy="12" r="3"/><circle cx="9.5" cy="12" r="1"/><path d="M14 9.5h4M14 14.5h4M16 7.5v2"/></svg>',
    mem_desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M6 11.5h2M10 11.5h4M16 11.5h2M6.5 8v-2M9.5 8v-2M14.5 8v-2M17.5 8v-2M6.5 16v2M9.5 16v2M14.5 16v2M17.5 16v2"/></svg>',
    mem_laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4" y="8" width="16" height="6" rx="1.5"/><path d="M5.5 11h2M9 11h3M14 11h2M6 8v-1.5M18 8v-1.5M6 14v1.5M18 14v1.5"/></svg>',
    ssd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="8" cy="12" r="2.2"/><path d="M13 10.5h6M13 13.5h6"/></svg>',
    ssd_usb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3.5" width="8" height="14" rx="2"/><path d="M12 3.5v3M13.5 10h2M13.5 13h2"/><rect x="10" y="17.5" width="4" height="4" rx="1"/></svg>',
    hdd_usb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="13" rx="2"/><circle cx="15.5" cy="10" r="1.6"/><path d="M5 10h5"/><rect x="9.5" y="16.5" width="5" height="4.5" rx="1"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2" y="6.5" width="20" height="11" rx="2"/><path d="M5 10h.01M8 10h.01M11 10h.01M14 10h.01M17 10h.01M5.5 13.5h.01M8.5 13.5h.01M11.5 13.5h.01M14.5 13.5h.01M17.5 13.5h.01M20 13.5h.01M7 16h10"/></svg>',
    mouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2.5" width="8" height="15.5" rx="4"/><path d="M12 2.5v5M8 21.5h8"/><path d="M12 18v3.5"/></svg>',
  };

  function typePage(type) {
    var t = TYPE_PAGE[type];
    return t ? '../' + encodeURIComponent(t.folder) + '/' + encodeURIComponent(t.file).replace(/%20/g, '%20') : null;
  }
  function typeHref(type) {
    var t = TYPE_PAGE[type];
    return t ? '../' + t.folder + '/' + encodeURIComponent(t.file) : '#';
  }

  /* ---------- 分类卡片 ---------- */
  async function renderCategories() {
    var grid = document.getElementById('catGrid');
    var res = await api.hardware();
    if (res.code !== 0) {
      grid.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:var(--text-3)">分类加载失败：' + UI.esc(res.message || '') + '</div>';
      return;
    }
    document.getElementById('statTypes').textContent = res.data.length;
    grid.innerHTML = res.data.map(function (h) {
      var icon = ICONS[h.type] || ICONS.cpu;
      return '<a class="cat-card" href="' + typeHref(h.type) + '" data-type="' + h.type + '">' +
        '<div class="cc-ico">' + icon + '</div>' +
        '<h3>' + UI.esc(h.name) + '</h3>' +
        '<div class="cc-meta"><span>' + h.productCount + ' 个型号</span><span class="tag plain">30 天走势</span></div>' +
        '<div class="cc-price">今日最低 <b>' + (h.minPrice != null ? '¥' + Number(h.minPrice).toLocaleString('zh-CN') : '--') + '</b></div>' +
        '<span class="cc-arrow">→</span>' +
        '</a>';
    }).join('');
  }

  /* ---------- 搜索 ---------- */
  var input = document.getElementById('searchInput');
  var panel = document.getElementById('searchPanel');
  var searchBox = document.getElementById('searchBox');

  async function doSearch() {
    var kw = input.value.trim();
    if (!kw) { panel.hidden = true; return; }
    var res = await api.search(kw);
    if (res.code !== 0) {
      panel.hidden = false;
      panel.innerHTML = '<div class="search-empty">搜索失败：' + UI.esc(res.message || '') + '</div>';
      return;
    }
    var d = res.data;
    var html = '';
    if (d.hardware && d.hardware.length) {
      html += '<div class="sp-group">硬件分类</div>';
      html += d.hardware.map(function (h) {
        return '<div class="search-item" data-href="' + typeHref(h.type) + '">' +
          '<div class="si-ico">' + (ICONS[h.type] || ICONS.cpu) + '</div>' +
          '<div class="si-main"><b>' + UI.esc(h.name) + '</b><i>点击查看价格走势与避坑指南</i></div>' +
          '</div>';
      }).join('');
    }
    if (d.products && d.products.length) {
      html += '<div class="sp-group">商品 / 型号（' + d.products.length + '）</div>';
      html += d.products.slice(0, 12).map(function (p) {
        return '<div class="search-item" data-href="' + typeHref(p.hardwareType) + '">' +
          '<div class="si-ico">' + (ICONS[p.hardwareType] || ICONS.cpu) + '</div>' +
          '<div class="si-main"><b>' + UI.esc(p.brand) + ' ' + UI.esc(p.model) + '（' + UI.esc(p.spec) + '）</b>' +
          '<i>' + UI.esc(p.typeName) + '</i></div>' +
          '<div class="si-price">' + UI.money(p.latestPrice) + '<i>' + UI.esc(p.platform || '') + ' 最新价</i></div>' +
          '</div>';
      }).join('');
    }
    if (!html) html = '<div class="search-empty">没有找到与「' + UI.esc(kw) + '」相关的硬件，换个关键词试试</div>';
    panel.innerHTML = html;
    panel.hidden = false;
    panel.querySelectorAll('.search-item').forEach(function (it) {
      it.onclick = function () { location.href = it.getAttribute('data-href'); };
    });
  }

  document.getElementById('searchBtn').onclick = doSearch;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
  input.addEventListener('input', function () { if (!input.value.trim()) panel.hidden = true; });
  document.addEventListener('click', function (e) {
    if (!searchBox.contains(e.target)) panel.hidden = true;
  });

  /* ---------- AI 入口 ---------- */
  document.getElementById('navAi').onclick = function (e) {
    e.preventDefault();
    if (Auth.requireLogin(function () { window.askAI(); })) window.askAI();
  };
  document.getElementById('aiStart').onclick = function () {
    if (Auth.requireLogin(function () { window.askAI(); })) window.askAI();
  };

  document.addEventListener('DOMContentLoaded', renderCategories);
})();
