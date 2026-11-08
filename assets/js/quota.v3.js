/* ============================================================
 * quota.v2.js —— 订阅额度展示 + 升级弹窗（42901 / 40301 引导升级）
 * （v2：为避免浏览器对 file:// 旧文件名的顽固缓存，更名为 quota.v2.js）
 *
 * 订阅方案卡片按钮规则：
 *   - 当前方案：显示"当前方案"；
 *   - demo 演示账号 / 根管理员 Controler：可随便切换（免费方案显示"切换回免费版"）；
 *   - 真实用户：免费方案为默认方案，订阅到其他方案后免费方案一栏不显示任何
 *     "立即升级"按钮（只显示"默认免费方案 · 到期未续费自动切回"提示），
 *     到期未续费由后端自动切换回免费方案；
 *   - 付费方案：显示"¥X/月 立即升级"。
 * ============================================================ */
(function () {
  'use strict';

  var PLAN_TAG = { 1: 'tag plain', 2: 'tag teal', 3: 'tag blue', 4: 'tag gold' };

  /* 顶栏额度徽章：当前：免费版 · 今日剩余 3 次 */
  async function refreshQuotaChip() {
    var el = document.getElementById('headerQuota');
    if (!el || !Auth.logged()) return;
    try {
      var res = await api.quota();
      if (res.code === 0) {
        var q = res.data;
        if (q.dayUnlimited) {
          // 付费方案只限每月：顶栏只显示本月剩余
          el.innerHTML = '<span class="dot"></span>当前：' + UI.esc(q.plan) +
            ' · 本月剩余 <b>' + q.monthRemain + '</b> 次';
          el.title = '每日不限，本月剩余 ' + q.monthRemain + ' 次';
          if (q.monthRemain <= 0) el.classList.add('empty');
          else el.classList.remove('empty');
        } else {
          el.innerHTML = '<span class="dot"></span>当前：' + UI.esc(q.plan) +
            ' · 今日剩余 <b>' + q.dayRemain + '</b> 次';
          el.title = '本月剩余 ' + q.monthRemain + ' 次';
          if (q.dayRemain <= 0) el.classList.add('empty');
          else el.classList.remove('empty');
        }
      } else if (res.code === 40101) {
        el.innerHTML = '<span class="dot"></span>未登录';
      } else {
        el.innerHTML = '<span class="dot"></span>' + UI.esc(res.message || '额度获取失败');
      }
    } catch (e) {
      el.innerHTML = '<span class="dot"></span>额度获取失败';
    }
  }

  /* ---------- 订阅按钮监视器（付款码弹窗 / 演示账号模拟支付） ---------- */
  var payModalOpen = false;

  /* 真实账户点订阅 → 弹付款码；营业执照未办理 → 显示"功能开发中，目前暂不支持" */
  function openPayModal(info, done) {
    if (payModalOpen) return;
    payModalOpen = true;
    info = info || {};
    var body = document.createElement('div');
    body.className = 'pay-modal';
    body.innerHTML =
      '<div class="pay-qr-box">' +
      (info.qrContent
        ? '<span class="pay-qr-text">' + UI.esc(info.qrContent) + '</span>'
        : '<span>付款码区域</span>') +
      '</div>' +
      '<div class="pay-dev">功能开发中，目前暂不支持</div>' +
      '<div class="pay-info">' +
      (info.planName ? '订阅：<b>' + UI.esc(info.planName) + '</b>' : '订阅套餐') +
      (info.amount != null ? ' · 金额 <b>¥' + info.amount + '</b>' : '') +
      (info.orderNo ? ' · 订单号 ' + UI.esc(info.orderNo) : '') +
      '</div>';
    var modal = UI.openModal({
      title: '💳 订阅支付',
      sub: '扫描付款码完成支付',
      body: body,
      buttons: [{ text: '我知道了', cls: 'btn-ghost' }],
    });
    var originClose = modal.close;
    modal.close = function () {
      payModalOpen = false;
      originClose.call(modal);
    };
    if (done) done({ code: -1, message: '支付功能开发中，目前暂不支持' });
  }

  /**
   * 订阅按钮统一入口（监视器）：
   * - demo 演示账号 / 根管理员 Controler：模拟支付直接开通；
   * - 真实账户：弹付款码（当前"功能开发中，目前暂不支持"）。
   * info 可选：{planName, amount} 用于付款码弹窗展示。
   */
  function handleSubscribe(planId, btn, done, info) {
    var user = Auth.user();
    if (user === 'demo' || user === 'Controler') {
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = '模拟支付中…';
      api.subscribe(planId).then(function (r) {
        if (r && r.code === 0 && r.data && r.data.needsPay) {
          openPayModal(r.data, done); // 后端配置了真实支付渠道时也弹付款码
        } else {
          done(r);
        }
        btn.disabled = false;
        btn.textContent = label;
      });
    } else {
      openPayModal(info || {}, done);
    }
  }

  window.SubscriptionFlow = { subscribe: handleSubscribe };

  /* ---------- 订阅套餐卡片（升级弹窗与账户页共用） ---------- */
  function planCardHtml(plan, opts) {
    opts = opts || {};
    // 后端把 Long 序列化为字符串（如 id="1"），这里统一转数字再比较，
    // 避免 "1" === 1 为 false 导致免费方案被误判成付费方案
    var pid = Number(plan.id);
    var cid = (opts.currentPlanId == null || opts.currentPlanId === '')
      ? null : Number(opts.currentPlanId);
    var cur = pid === cid;
    var cls = PLAN_TAG[plan.id] || 'tag plain';
    // demo 演示账号与根管理员 Controler 可随便切换方案（含切回免费方案）；
    // 真实用户：免费方案一栏不显示"立即升级"按钮，到期未续费由后端自动切换回免费方案
    var allowFreeSwitch = opts.allowFreeSwitch != null
      ? opts.allowFreeSwitch
      : (Auth.user() === 'demo' || Auth.user() === 'Controler');
    var btns = '';
    if (cur) {
      btns = '<button class="btn btn-ghost btn-sm" disabled>当前方案</button>';
    } else if (pid === 1) {
      if (allowFreeSwitch) {
        btns = '<button class="btn btn-ghost btn-sm" data-plan="1">切换回免费版</button>';
      } else if (cid) {
        btns = '<span class="plan-free-note">默认免费方案 · 到期未续费自动切回</span>';
      } else {
        btns = '<button class="btn btn-ghost btn-sm" data-plan="1">免费使用</button>';
      }
    } else {
      btns = '<button class="btn btn-primary btn-sm" data-plan="' + plan.id + '">¥' +
        plan.priceMonth + '/月 立即升级</button>';
    }
    return '' +
      '<div class="plan-card' + (cur ? ' current' : '') + '">' +
      '  <div class="plan-head">' +
      '    <span class="' + cls + '">' + UI.esc(plan.planName) + '</span>' +
      (pid === 1 ? '' : '<span class="plan-price">¥' + plan.priceMonth + '<i>/月</i></span>') +
      '  </div>' +
      '  <div class="plan-quota">' +
      (pid > 0 && Number(plan.quotaDay) > 0
        ? 'AI 额度：<b>' + plan.quotaDay + ' 次/日</b> · <b>' + plan.quotaMonth + ' 次/月</b>'
        : 'AI 额度：<b>' + plan.quotaMonth + ' 次/月</b>（每日不限）') +
      '</div>' +
      '  <div class="plan-desc">' + UI.esc(plan.description) + '</div>' +
      '  <div class="plan-feats">' +
      (plan.multimodal ? '<span>✓ 支持图片问答</span>' : '<span>✕ 仅文本问答</span>') +
      (pid >= 3 ? '<span>✓ 多硬件对比</span>' : '') +
      (pid >= 4 ? '<span>✓ 配置单导出</span>' : '') +
      '  </div>' +
      '  <div class="plan-foot">' + btns + '</div>' +
      '</div>';
  }

  /* 升级弹窗：额度用尽(42901) / 套餐能力不足(40301) 时打开 */
  function openUpgradeModal(opts) {
    if (!Auth.logged()) { Auth.requireLogin(); return; }
    api.plans().then(function (res) {
      if (res.code !== 0) { UI.toast(res.message || '套餐获取失败', 'err'); return; }
      api.quota().then(function (qr) {
        var currentId = qr.code === 0 ? qr.data.planId : null;
        var wrapper = document.createElement('div');
        wrapper.className = 'plan-grid-wrap';
        var inner = document.createElement('div');
        inner.className = 'plan-grid';
        inner.innerHTML = res.data.map(function (p) {
          return planCardHtml(p, { currentPlanId: currentId });
        }).join('');
        wrapper.appendChild(inner);
        var modal = UI.openModal({
          title: '⬆ 升级订阅',
          sub: (opts && opts.reason) || '当前套餐 AI 额度已用完，升级后可继续咨询。',
          body: wrapper,
          buttons: [{ text: '稍后再说', cls: 'btn-ghost' }],
        });
        inner.querySelectorAll('[data-plan]').forEach(function (btn) {
          btn.onclick = function () {
            var planId = +btn.getAttribute('data-plan');
            var plan = null;
            res.data.forEach(function (p) { if (Number(p.id) === planId) plan = p; });
            handleSubscribe(planId, btn, function (r) {
              if (r && r.code === 0) {
                modal.close();
                UI.toast('已升级为「' + r.data.planName + '」，继续问 AI 吧');
                refreshQuotaChip();
                if (typeof window.onSubscribeChange === 'function') window.onSubscribeChange();
              } else if (r) {
                UI.toast(r.message || '升级失败', 'err');
              }
            }, plan ? { planName: plan.planName, amount: plan.priceMonth } : null);
          };
        });
      });
    });
  }

  /* 40101 / 额度提示统一处理 */
  function handleAuthError(res) {
    if (res.code === 42901) {
      openUpgradeModal({ reason: res.message });
      return true;
    }
    if (res.code === 40301) {
      openUpgradeModal({ reason: res.message });
      return true;
    }
    if (res.code === 40101) {
      Auth.requireLogin();
      return true;
    }
    return false;
  }

  window.refreshQuotaChip = refreshQuotaChip;
  window.planCardHtml = planCardHtml;
  window.PlanGridTag = PLAN_TAG;
  window.UpgradeModal = { open: openUpgradeModal };
  window.QuotaKit = { refreshQuotaChip: refreshQuotaChip, handleAuthError: handleAuthError, planCardHtml: planCardHtml };
})();
