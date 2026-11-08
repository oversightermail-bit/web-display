/* ============================================================
 * price-page.js —— 价格波动页面通用逻辑（10 个硬件页面共用，F3）
 * 页面通过 <body data-type="xxx"> 或 ./js/page.js 的 window.PRICE_TYPE 指定类型
 * 数据流：api.priceContent(type) + api.priceSeries(type) → 文案 / ECharts / 推荐平台
 * ============================================================ */
(function () {
  'use strict';

  function getType() {
    return window.PRICE_TYPE ||
      new URLSearchParams(location.search).get('type') ||
      (document.body && document.body.dataset.type) || 'cpu';
  }

  function fillSkeleton() {
    var ids = ['funcText', 'sceneText', 'pitfallText'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="skeleton" style="height:14px;margin:6px 0"></div><div class="skeleton" style="height:14px;margin:6px 0;width:82%"></div>';
    });
  }

  function renderContent(c) {
    var title = document.getElementById('hwTitle');
    if (title) title.textContent = c.name;
    var tagline = document.getElementById('hwTagline');
    if (tagline) tagline.textContent = (c.func || '').split('。')[0] + '。';
    document.title = c.name + ' 价格走势 · ' + AppConfig.SITE_NAME;
    setText('funcText', c.func);
    setText('sceneText', c.scene);
    setText('pitfallText', c.pitfall);
    var ut = document.getElementById('updateTime');
    if (ut) ut.textContent = '数据更新于 ' + UI.today() + '（爬虫每日 08/12/18/22 点抓取）';
  }
  function setText(id, t) {
    var el = document.getElementById(id);
    if (el) el.textContent = t || '--';
  }

  function renderSeries(s) {
    var box = document.getElementById('chartBox');
    if (box) PriceChart.render(box, s);

    var legendHint = document.getElementById('legendHint');
    if (legendHint) {
      legendHint.innerHTML = '共 ' + s.series.length + ' 条价格折线 · <b>点击图例</b>可显示/隐藏任意一条 · 滚轮或拖动缩放查看细节';
    }

    /* 高性价比推荐表：性价比指数 = 性能分 ÷ ln(参考价) × 100（对数归一化），
       按指数降序；无真实价显示"暂无数据"，绝不用模拟价填充 */
    var body = document.getElementById('recommendBody');
    if (!body) return;
    if (!s.recommend || !s.recommend.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3)">暂无数据</td></tr>';
      return;
    }
    var list = s.recommend.slice().sort(function (a, b) {
      var va = a.valueIndex == null ? -1 : Number(a.valueIndex);
      var vb = b.valueIndex == null ? -1 : Number(b.valueIndex);
      return vb - va;
    });
    var todayStr = UI.today();
    body.innerHTML = list.map(function (r, idx) {
      var badge = r.valueIndex == null
        ? '<span class="tag plain">暂无数据</span>'
        : (idx < 2
          ? '<span class="tag best">高性价比之选</span>'
          : (idx < 5 ? '<span class="tag plain">值得关注</span>' : '<span class="tag plain">--</span>'));
      var perf = (r.perf != null && r.perf > 0)
        ? '<span title="' + UI.esc(r.perfBasis || '性能分（基准自动映射）') + '">' + r.perf + '<span class="muted"> / 100</span></span>'
        : '--';
      var priceCell = (r.price == null)
        ? '<span class="muted">暂无数据</span>'
        : '<b class="price-strong">' + UI.money(r.price) + '</b>' +
          (r.priceDate && r.priceDate !== todayStr
            ? ' <span class="muted">(' + UI.esc(String(r.priceDate).slice(5)) + ' 采集)</span>' : '');
      var value = r.valueIndex != null
        ? '<b class="value-strong">' + Number(r.valueIndex).toFixed(1) + '</b>' : '--';
      return '<tr>' +
        '<td><strong>' + UI.esc(r.brand) + ' ' + UI.esc(r.model) + '</strong><i class="td-spec">' + UI.esc(r.spec) + '</i></td>' +
        '<td>' + priceCell + '</td>' +
        '<td>' + perf + '</td>' +
        '<td>' + value + '</td>' +
        '<td>' + badge + '</td>' +
        '</tr>';
    }).join('');
  }

  function showError(msg) {
    var box = document.getElementById('hwMain');
    if (box) box.innerHTML = '<div class="card" style="text-align:center;padding:60px 20px">' +
      '<div style="font-size:40px;margin-bottom:12px">😵</div>' +
      '<h3 style="margin-bottom:8px">页面加载失败</h3>' +
      '<p style="color:var(--text-2);margin-bottom:20px">' + UI.esc(msg || '') + '</p>' +
      '<button class="btn btn-primary" onclick="location.reload()">重新加载</button>' +
      '<a class="btn btn-ghost" style="margin-left:10px" href="../首页/shouye.html">返回首页</a>' +
      '</div>';
  }

  async function init() {
    var type = getType();
    document.body.dataset.type = type;
    fillSkeleton();
    var resC, resS;
    try {
      var pair = await Promise.all([api.priceContent(type), api.priceSeries(type)]);
      resC = pair[0]; resS = pair[1];
    } catch (e) {
      showError(e.message || '网络异常');
      return;
    }
    if (resC.code !== 0) { showError(resC.message); return; }
    renderContent(resC.data);
    if (resS.code !== 0) {
      var box = document.getElementById('chartBox');
      if (box) box.innerHTML = '<div class="chart-error">折线数据获取失败：' + UI.esc(resS.message || '') + '</div>';
    } else {
      renderSeries(resS.data);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  /* 顶栏「AI 助手」按钮（硬件页内联 onclick 调用） */
  window.HW_AIBtn = function (e) {
    if (e) e.preventDefault();
    if (Auth.requireLogin(function () { window.askAI(); })) window.askAI();
    return false;
  };
})();
