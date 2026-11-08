/* ============================================================
 * guanli.js —— 管理中心逻辑（仅管理员）
 *  1) 爬虫控制：单轮"启动爬虫" + 定时抓取（每日 08/12/18/22 点，服务器常驻）
 *     开启/停止 + 最近一轮统计（解析/写入/沿用上一真实价/暂无数据）；
 *  2) AI 对话端 API：免费账户与付费账户两档分开配置（密钥/接口地址/模型名各自独立，保存即时生效）；
 *  3) 用户管理：列表 / 改角色 / 重置密码 / 删除。
 * ============================================================ */
(function () {
  'use strict';

  var els = {};

  function $(id) { return document.getElementById(id); }

  function apiCall(promise, errMsg) {
    return promise.then(function (res) {
      if (!res || res.code !== 0) {
        UI.toast((res && res.message) || errMsg || '操作失败', 'err');
        if (res && res.code === 40101) setTimeout(function () { location.href = '../登录界面/denlu.html'; }, 800);
        return null;
      }
      return res.data;
    });
  }

  /* ---------- 权限守卫 ---------- */
  function guard() {
    if (!Auth.logged()) {
      $('loginGuard').style.display = '';
      return false;
    }
    if (!Auth.isAdmin()) {
      $('adminGuard').style.display = '';
      return false;
    }
    $('adminMain').style.display = '';
    return true;
  }

  /* ---------- 爬虫控制 ---------- */
  function renderCrawlerStatus(data) {
    if (!data) return;
    $('crawlerState').textContent = data.running
      ? '⏳ 爬虫运行中，请稍候…' : '● 空闲';
    $('crawlerState').style.color = data.running ? '#b45309' : '#16a34a';
    renderScheduleStatus(data);
    var st = data.lastRound || {};
    if (st.time && st.time !== '暂无抓取统计') {
      $('stTime').textContent = String(st.time).slice(5, 16);
      var platforms = st.platforms || [];
      var parsed = 0, written = st.prices_written || 0;
      platforms.forEach(function (p) { parsed += p.parsed || 0; });
      $('stParsed').textContent = parsed;
      $('stWritten').textContent = written;
      $('stCarry').textContent = (st.carry_over != null) ? st.carry_over : '--';
      $('stNoData').textContent = (st.no_data != null) ? st.no_data : '--';
    } else {
      $('stTime').textContent = '暂无';
    }
  }

  /* 定时抓取（每日 08/12/18/22 点，服务器长期运行）状态与按钮切换 */
  function renderScheduleStatus(data) {
    var on = !!data.scheduleRunning;
    var startBtn = $('crawlerScheduleBtn');
    var stopBtn = $('crawlerScheduleStopBtn');
    var state = $('crawlerScheduleState');
    if (!startBtn || !stopBtn || !state) return;
    state.textContent = on ? '⏳ 定时抓取运行中（每日 08/12/18/22 点）' : '● 定时抓取未开启';
    state.style.color = on ? '#0e7490' : '#8a8f98';
    startBtn.style.display = on ? 'none' : '';
    stopBtn.style.display = on ? '' : 'none';
  }

  function refreshCrawler() {
    apiCall(window.api.crawlerStatus(), '读取爬虫状态失败').then(renderCrawlerStatus);
  }

  function bindCrawler() {
    $('crawlBtn').onclick = function () {
      var btn = $('crawlBtn');
      btn.disabled = true; btn.textContent = '启动中…';
      apiCall(window.api.crawlerStart(), '启动爬虫失败').then(function (data) {
        if (data) UI.toast(data.message || '已启动');
        refreshCrawler();
        // 爬虫一轮约 3~5 分钟，期间每 10 秒刷新一次状态
        var timer = setInterval(function () {
          refreshCrawler();
          window.api.crawlerStatus().then(function (res) {
            if (res && res.code === 0 && res.data && !res.data.running) clearInterval(timer);
          });
        }, 10000);
        setTimeout(function () {
          btn.disabled = false; btn.textContent = '▶ 启动爬虫';
        }, 5000);
      });
    };

    var schBtn = $('crawlerScheduleBtn');
    var schStopBtn = $('crawlerScheduleStopBtn');
    if (schBtn) {
      schBtn.onclick = function () {
        schBtn.disabled = true;
        apiCall(window.api.crawlerScheduleStart(), '开启定时抓取失败').then(function (data) {
          if (data) UI.toast(data.message || '定时抓取已开启');
          refreshCrawler();
          setTimeout(function () { schBtn.disabled = false; }, 3000);
        });
      };
    }
    if (schStopBtn) {
      schStopBtn.onclick = function () {
        if (!confirm('确认停止定时抓取？停止后每日 08/12/18/22 点不再自动抓取，可随时重新开启。')) return;
        schStopBtn.disabled = true;
        apiCall(window.api.crawlerScheduleStop(), '停止定时抓取失败').then(function (data) {
          if (data) UI.toast(data.message || '定时抓取已停止');
          refreshCrawler();
          setTimeout(function () { schStopBtn.disabled = false; }, 3000);
        });
      };
    }
  }

  /* ---------- AI API 配置（免费 / 付费两档分开管理） ---------- */
  var AI_TIERS = [
    { tier: 'free', cap: 'Free', label: '免费' },
    { tier: 'paid', cap: 'Paid', label: '付费' },
  ];

  function bindAi() {
    apiCall(window.api.aiConfig(), '读取 AI 配置失败').then(function (data) {
      if (!data) return;
      AI_TIERS.forEach(function (t) {
        var cfg = (data[t.tier] || {});
        $('ai' + t.cap + 'Base').value = cfg.baseUrl || '';
        $('ai' + t.cap + 'Model').value = cfg.model || '';
        $('ai' + t.cap + 'Hint').textContent = cfg.configured
          ? '当前：已配置（' + cfg.apiKeyMasked + '），保存新密钥可覆盖'
          : '当前：未配置（使用本地演示模型）';
      });
    });
    AI_TIERS.forEach(function (t) {
      $('ai' + t.cap + 'SaveBtn').onclick = function () {
        var key = $('ai' + t.cap + 'Key').value.trim();
        var base = $('ai' + t.cap + 'Base').value.trim();
        var model = $('ai' + t.cap + 'Model').value.trim();
        // 无默认地址：填密钥时必须同时填接口地址与模型名（与后端校验一致）
        if (key && !base) { UI.toast('填写密钥时必须填写接口地址（无默认地址）', 'err'); return; }
        if (key && !model) { UI.toast('填写密钥时必须填写模型名（无默认模型）', 'err'); return; }
        var btn = $('ai' + t.cap + 'SaveBtn');
        btn.disabled = true;
        apiCall(window.api.saveAiConfig({
          tier: t.tier, apiKey: key, baseUrl: base, model: model,
        }), '保存失败').then(function (data) {
          if (data) {
            UI.toast(key
              ? '已保存，' + t.label + '账户 AI 即刻走云端大模型'
              : '已清空密钥，' + t.label + '账户 AI 回落本地演示模型');
            $('ai' + t.cap + 'Key').value = '';
          }
          btn.disabled = false;
        });
      };
    });
  }

  /* ---------- 用户管理 ---------- */
  function rowHtml(u) {
    var roleSel = '<select class="input" data-role="' + UI.esc(u.id) + '" style="width:110px">' +
      '<option value="USER"' + (u.role === 'USER' ? ' selected' : '') + '>USER</option>' +
      '<option value="ADMIN"' + (u.role === 'ADMIN' ? ' selected' : '') + '>ADMIN</option>' +
      '</select>';
    var protectedUser = u.username === 'Controler';
    return '<tr>' +
      '<td>' + u.id + '</td>' +
      '<td><strong>' + UI.esc(u.username) + '</strong>' + (protectedUser ? ' <span class="tag best">根管理员</span>' : '') + '</td>' +
      '<td>' + (protectedUser ? UI.esc(u.role) : roleSel) + '</td>' +
      '<td>' + UI.esc(u.plan || '--') + '</td>' +
      '<td>' + (u.createTime ? UI.fmtTime(u.createTime) : '--') + '</td>' +
      '<td>' +
        '<button class="btn btn-ghost btn-sm" data-reset="' + u.id + '" data-name="' + UI.esc(u.username) + '">重置密码</button>' +
        (protectedUser
          ? '<span class="muted" style="margin-left:8px">不可删除</span>'
          : '<button class="btn btn-ghost btn-sm" style="color:#dc2626" data-del="' + u.id + '" data-name="' + UI.esc(u.username) + '">删除</button>') +
      '</td>' +
      '</tr>';
  }

  function renderUsers(users) {
    if (!users) return;
    $('userBody').innerHTML = users.map(rowHtml).join('');
    // 改角色
    $('userBody').querySelectorAll('[data-role]').forEach(function (sel) {
      sel.onchange = function () {
        apiCall(window.api.adminUpdateUser(sel.dataset.role, { role: sel.value }), '修改角色失败')
          .then(function () { UI.toast('角色已更新'); refreshUsers(); });
      };
    });
    // 重置密码
    $('userBody').querySelectorAll('[data-reset]').forEach(function (btn) {
      btn.onclick = function () {
        var pwd = prompt('为 ' + btn.dataset.name + ' 设置新密码（6-32 位）：');
        if (!pwd) return;
        apiCall(window.api.adminUpdateUser(btn.dataset.reset, { password: pwd }), '重置密码失败')
          .then(function () { UI.toast('密码已重置'); });
      };
    });
    // 删除
    $('userBody').querySelectorAll('[data-del]').forEach(function (btn) {
      btn.onclick = function () {
        if (!confirm('确认删除用户 ' + btn.dataset.name + '？其订阅、会话与额度流水将一并删除，不可恢复。')) return;
        apiCall(window.api.adminDeleteUser(btn.dataset.del), '删除失败')
          .then(function () { UI.toast('已删除'); refreshUsers(); });
      };
    });
  }

  function refreshUsers() {
    apiCall(window.api.adminUsers(), '读取用户列表失败').then(renderUsers);
  }

  /* ---------- 后端服务管理（仅根管理员 Controler 可见/可调） ---------- */
  function fmtUptime(sec) {
    sec = Math.floor(Number(sec) || 0);
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600),
        m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d > 0) return d + '天' + h + '时';
    if (h > 0) return h + '时' + m + '分';
    return m + '分' + s + '秒';
  }

  function bindBackend() {
    var card = document.getElementById('backendCard');
    if (!card) return;
    if (Auth.user() !== 'Controler') return; // 仅根管理员可见
    card.style.display = '';

    function renderBackend(data) {
      if (!data) return;
      $('backendState').textContent = '● 运行中（' + (data.jarPath || '') + '）';
      $('backendState').style.color = '#16a34a';
      $('bkPid').textContent = data.pid || '--';
      $('bkStart').textContent = data.startedAt ? UI.fmtTime(data.startedAt) : '--';
      $('bkUp').textContent = fmtUptime(data.uptimeSeconds);
      $('bkJava').textContent = data.javaVersion || '--';
      $('bkOs').textContent = data.os || '--';
    }
    function refreshBackend() {
      apiCall(window.api.backendStatus(), '读取后端状态失败').then(renderBackend);
    }
    $('backendRestartBtn').onclick = function () {
      if (!confirm('确认重启后端服务？重启期间约 5~8 秒不可用，本页会自动恢复。')) return;
      var btn = $('backendRestartBtn');
      btn.disabled = true;
      apiCall(window.api.backendRestart(), '重启失败').then(function (d) {
        if (d && d.ok) {
          UI.toast('重启中，约 8 秒后自动刷新页面');
          setTimeout(function () { location.reload(); }, 8000);
        }
        btn.disabled = false;
      });
    };
    refreshBackend();
  }

  /* ---------- 初始化 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (!guard()) return;
    bindCrawler();
    bindAi();
    bindBackend();
    refreshCrawler();
    refreshUsers();
    // AI 助手入口复用公共逻辑
    var navAi = document.getElementById('navAi');
    if (navAi) navAi.onclick = function (e) { e.preventDefault(); if (typeof window.askAI === 'function') window.askAI(); };
  });
})();
