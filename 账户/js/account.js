/* ============================================================
 * account.js —— 账户页：个人信息 / 当前订阅 / 额度进度 /
 *              套餐订阅 / 额度消耗明细（F7 订阅与额度）
 * ============================================================ */
(function () {
  'use strict';

  var page = 1, size = 20, totalPages = 1;
  var currentPlanId = null;

  function guard() {
    if (Auth.logged()) return true;
    document.getElementById('loginGuard').style.display = 'block';
    document.getElementById('accountMain').style.display = 'none';
    return false;
  }

  async function loadQuotaAndSub() {
    var qr = await api.quota();
    var sr = await api.mySubscription();
    if (qr.code === 0) {
      var q = qr.data;
      currentPlanId = q.planId;
      document.getElementById('acctName').textContent = Auth.user();
      var first = (Auth.user() || 'U').charAt(0).toUpperCase();
      document.getElementById('avatarBox').textContent = first;
      document.getElementById('acctPlanTag').textContent = q.plan;
      document.getElementById('acctExpire').textContent = 'AI 问答' + (q.multimodal ? '含图片' : '仅文本');

      /* 当前订阅卡 */
      var price = '';
      if (sr.code === 0 && sr.data.expireTime) {
        price = '有效期至 ' + UI.fmtTime(sr.data.expireTime);
      } else if (sr.code === 0 && q.plan && q.plan.indexOf('免费') < 0) {
        price = '长期有效';
      } else {
        price = '免费版 · 长期有效';
      }
      document.getElementById('subCard').innerHTML =
        '<div class="sub-plan-name">' + UI.esc(q.plan) + '</div>' +
        '<div class="sub-plan-price">' + UI.esc(price) + '</div>' +
        '<div class="sub-detail">' +
        '  <span>日额度 <b>' + (q.dayTotal > 0 ? q.dayTotal + ' 次/日' : '每日不限') + '</b></span>' +
        '  <span>月额度 <b>' + q.monthTotal + ' 次/月</b></span>' +
        '  <span>图片问答 <b>' + (q.multimodal ? '支持（计 2 次/问）' : '不支持，升级解锁') + '</b></span>' +
        '</div>';

      /* 额度进度 */
      renderQuotaBlocks(q);
    } else {
      document.getElementById('subCard').textContent = '订阅信息获取失败';
    }
  }

  function renderQuotaBlocks(q) {
    var html = '';
    // 每日不限（付费方案只限每月）：只显示月额度块
    if (q.dayTotal > 0) {
      var dayPct = Math.round(q.dayUsed / q.dayTotal * 100);
      html += '<div class="quota-block">' +
        '  <div class="qb-head"><span>今日额度</span><b>' + q.dayUsed + ' / ' + q.dayTotal + ' 次（剩 ' + q.dayRemain + '）</b></div>' +
        '  <div class="progress"><i class="' + (dayPct >= 80 ? 'warn' : '') + '" style="width:' + dayPct + '%"></i></div>' +
        '  <div class="qb-note">每日 0 点自动重置</div>' +
        '</div>';
    }
    var monPct = q.monthTotal > 0 ? Math.round(q.monthUsed / q.monthTotal * 100) : 0;
    html += '<div class="quota-block">' +
      '  <div class="qb-head"><span>本月额度</span><b>' + q.monthUsed + ' / ' + q.monthTotal + ' 次（剩 ' + q.monthRemain + '）</b></div>' +
      '  <div class="progress"><i class="' + (monPct >= 80 ? 'warn' : '') + '" style="width:' + monPct + '%"></i></div>' +
      '  <div class="qb-note">每月 1 日自动重置</div>' +
      '</div>';
    document.getElementById('quotaBlocks').innerHTML = html;
  }

  async function loadPlans() {
    var res = await api.plans();
    var grid = document.getElementById('planGrid');
    if (res.code !== 0) {
      grid.innerHTML = '<p style="color:var(--text-3)">套餐加载失败：' + UI.esc(res.message || '') + '</p>';
      return;
    }
    grid.innerHTML = res.data.map(function (p) {
      return planCardHtml(p, { currentPlanId: currentPlanId });
    }).join('');
    grid.querySelectorAll('[data-plan]').forEach(function (btn) {
      btn.onclick = function () {
        var planId = +btn.getAttribute('data-plan');
        var plan = null;
        res.data.forEach(function (p) { if (Number(p.id) === planId) plan = p; });
        // 订阅按钮监视器：真实账户弹付款码（开发中），demo/根管理员模拟支付直接开通
        SubscriptionFlow.subscribe(planId, btn, function (r) {
          if (r && r.code === 0) {
            UI.toast('已切换为「' + r.data.planName + '」');
            loadQuotaAndSub().then(loadPlans);
            refreshQuotaChip();
          } else if (r) {
            UI.toast(r.message || '操作失败', 'err');
          }
        }, plan ? { planName: plan.planName, amount: plan.priceMonth } : null);
      };
    });
  }

  async function loadLogs() {
    var body = document.getElementById('logBody');
    var res = await api.quotaLogs(page, size);
    if (res.code !== 0) {
      body.innerHTML = '<tr><td colspan="4" class="log-empty">' + UI.esc(res.message || '明细加载失败') + '</td></tr>';
      return;
    }
    var d = res.data;
    totalPages = Math.max(1, Math.ceil(d.total / d.size));
    if (!d.records || !d.records.length) {
      body.innerHTML = '<tr><td colspan="4" class="log-empty">还没有消耗记录，去问问 AI 吧～</td></tr>';
    } else {
      body.innerHTML = d.records.map(function (l) {
        return '<tr>' +
          '<td>' + UI.fmtTime(l.createTime) + '</td>' +
          '<td><span class="log-type">' + UI.esc(l.quotaType || 'AI_CHAT') + '</span></td>' +
          '<td><span class="log-cost">' + (l.cost > 0 ? '-' + l.cost : '+' + (-l.cost)) + ' 次</span></td>' +
          '<td>' + UI.esc(l.sessionInput || '（图片提问）') + '</td>' +
          '</tr>';
      }).join('');
    }
    document.getElementById('logPageInfo').textContent = page + ' / ' + totalPages;
    document.getElementById('logPrev').disabled = page <= 1;
    document.getElementById('logNext').disabled = page >= totalPages;
    document.getElementById('logPager').style.display = 'flex';
  }

  document.getElementById('logPrev').onclick = function () { if (page > 1) { page--; loadLogs(); } };
  document.getElementById('logNext').onclick = function () { if (page < totalPages) { page++; loadLogs(); } };

  document.getElementById('navAi').onclick = function (e) {
    e.preventDefault();
    if (Auth.requireLogin(function () { window.askAI(); })) window.askAI();
  };

  /* 订阅变化后由 quota.js 回调刷新 */
  window.onSubscribeChange = function () {
    loadQuotaAndSub().then(loadPlans);
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!guard()) return;
    // "比赛演示模式：订阅即激活，跳过支付环节"仅 demo 演示账号可见
    if (Auth.user() === 'demo') {
      var demoSub = document.getElementById('planDemoSub');
      if (demoSub) demoSub.style.display = '';
    }
    loadQuotaAndSub().then(function () {
      loadPlans();
      loadLogs();
    });
  });
})();
