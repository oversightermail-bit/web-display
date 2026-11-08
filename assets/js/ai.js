/* ============================================================
 * ai.js —— AI 装机顾问悬浮入口 + 问答抽屉（F4）
 *   - 游客点击 → 引导登录
 *   - 文本问答计 1 次额度，含图片计 2 次（后端/Mock 同口径）
 *   - 额度用尽 42901 → 升级弹窗；免费版上传图片 → 40301 升级引导
 *   - 回答强制“简短大白话”（Mock 内置本地应答，真实模式走大模型）
 * ============================================================ */
(function () {
  'use strict';

  var built = false;
  var busy = false;
  var panelEl, fabEl, maskEl;
  var imageUrl = '';

  var QUICK = [
    '5000 元预算，主要打游戏，帮我配一台主机',
    'RTX 4060 和 RX 6750 XT 哪个划算？',
    '1TB 固态硬盘怎么选，有什么坑？',
  ];

  function build() {
    if (built) return;
    built = true;

    /* 悬浮按钮 */
    fabEl = document.createElement('button');
    fabEl.className = 'ai-fab';
    fabEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg><span>AI 助手</span>';
    fabEl.title = 'AI 装机顾问';
    fabEl.onclick = function () { Auth.requireLogin(open); };
    document.body.appendChild(fabEl);

    /* 遮罩 */
    maskEl = document.createElement('div');
    maskEl.className = 'ai-mask';
    maskEl.onclick = close;
    document.body.appendChild(maskEl);

    /* 抽屉面板 */
    panelEl = document.createElement('aside');
    panelEl.className = 'ai-panel';
    panelEl.innerHTML = '' +
      '<header class="ai-head">' +
      '  <div class="ai-title"><span class="ai-spark">✦</span><div><b>AI 装机顾问</b><i id="aiQuotaLine">当前额度加载中…</i></div></div>' +
      '  <button class="ai-close" title="关闭">✕</button>' +
      '</header>' +
      '<div class="ai-msgs" id="aiMsgs">' +
      '  <div class="ai-msg bot">你好！报<b>预算+用途</b>我出配置，报<b>两个型号</b>我比价格，也能<b>上传配置单图片</b>帮你把关。回答都是简短大白话。</div>' +
      '</div>' +
      '<div class="ai-quick" id="aiQuick"></div>' +
      '<div class="ai-imgpreview" id="aiImgPrev" style="display:none"></div>' +
      '<footer class="ai-inputbar">' +
      '  <button class="ai-upload" id="aiUpload" title="上传配置单 / 硬件图片（计2次额度）">🖼</button>' +
      '  <input type="file" id="aiFile" accept="image/*" hidden>' +
      '  <textarea id="aiInput" rows="1" placeholder="如：6000 元预算做视频剪辑…"></textarea>' +
      '  <button class="ai-send" id="aiSend">发送</button>' +
      '</footer>';
    document.body.appendChild(panelEl);

    /* 关闭按钮（右上角 ✕）与 Esc 键 */
    panelEl.querySelector('.ai-close').onclick = close;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panelEl.classList.contains('open')) close();
    });

    /* 快捷提问 */
    var quickBox = document.getElementById('aiQuick');
    QUICK.forEach(function (t) {
      var chip = document.createElement('button');
      chip.className = 'ai-quick-chip';
      chip.textContent = t;
      chip.onclick = function () {
        document.getElementById('aiInput').value = t;
        doSend();
      };
      quickBox.appendChild(chip);
    });

    var ta = document.getElementById('aiInput');
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    ta.addEventListener('input', function () {
      ta.style.height = 'auto';
      ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
    });

    document.getElementById('aiSend').onclick = doSend;
    document.getElementById('aiUpload').onclick = function () { document.getElementById('aiFile').click(); };
    document.getElementById('aiFile').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) { UI.toast('图片请控制在 4MB 以内', 'err'); e.target.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () {
        imageUrl = reader.result;
        var prev = document.getElementById('aiImgPrev');
        prev.style.display = 'flex';
        prev.innerHTML = '<img src="' + imageUrl + '" alt="上传图片"><div><i>已附加图片（本次问答计 2 次额度）</i><button class="ai-img-del" id="aiImgDel">移除</button></div>';
        document.getElementById('aiImgDel').onclick = function () { imageUrl = ''; prev.style.display = 'none'; };
      };
      reader.readAsDataURL(f);
      e.target.value = '';
    };
  }

  function open() {
    if (!Auth.logged()) return;
    build();
    panelEl.classList.add('open');
    maskEl.classList.add('show');
    refreshQuotaLine();
  }
  function close() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    maskEl.classList.remove('show');
  }
  window.AiPanel = { open: open, close: close };

  async function refreshQuotaLine() {
    var el = document.getElementById('aiQuotaLine');
    if (!el) return;
    try {
      var res = await api.quota();
      if (res.code === 0) {
        el.textContent = '当前：' + res.data.plan + ' · ' +
          (res.data.dayUnlimited
            ? '本月剩余 ' + res.data.monthRemain + ' 次（每日不限）'
            : '今日剩余 ' + res.data.dayRemain + ' 次 · 本月剩余 ' + res.data.monthRemain + ' 次');
      } else {
        el.textContent = '额度获取失败';
      }
    } catch (e) { el.textContent = '额度获取失败'; }
  }

  function appendMsg(role, html) {
    var box = document.getElementById('aiMsgs');
    var div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    div.innerHTML = html;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  async function doSend() {
    if (busy) return;
    var input = document.getElementById('aiInput');
    var text = input.value.trim();
    if (!text && !imageUrl) { UI.toast('请先输入问题或上传图片', 'err'); return; }
    if (!Auth.logged()) { Auth.requireLogin(); return; }
    busy = true;
    var img = imageUrl;               // 发送前保存图片数据
    appendMsg('user', UI.renderRich(text || '（图片提问）') +
      (img ? '<img class="ai-msg-img" src="' + img + '">' : ''));
    input.value = ''; input.style.height = 'auto';
    var prev = document.getElementById('aiImgPrev');
    imageUrl = ''; prev.style.display = 'none';

    var typing = appendMsg('bot', '<span class="typing"><i></i><i></i><i></i></span>');
    var res;
    try {
      res = await api.aiChat({ content: text || '请帮我看看这张图片', imageUrl: img });
    } catch (e) {
      typing.innerHTML = '出错了：' + UI.esc(e.message || '');
      busy = false;
      return;
    }
    if (res.code === 0) {
      typing.innerHTML = UI.renderRich(res.data.answer) +
        '<span class="ai-cost">本次消耗 ' + res.data.cost + ' 次额度 · ' +
        (res.data.dayUnlimited
          ? '本月剩余 ' + res.data.monthRemain + ' 次'
          : '今日剩余 ' + res.data.dayRemain + ' 次') +
        '</span>';
      refreshQuotaLine();
      if (typeof window.refreshQuotaChip === 'function') window.refreshQuotaChip();
    } else if (QuotaKit.handleAuthError(res)) {
      typing.remove();
    } else {
      typing.innerHTML = UI.esc(res.message || '回答失败，请稍后再试');
    }
    busy = false;
  }

  /* 供页面直接“带问题打开面板” */
  window.askAI = function (text) {
    if (!Auth.logged()) { Auth.requireLogin(); return; }
    build();
    open();
    if (text) {
      var input = document.getElementById('aiInput');
      input.value = text;
      setTimeout(doSend, 150);
    }
  };
})();
