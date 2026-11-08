/* ============================================================
 * chart.js —— ECharts 价格折线图渲染
 * 多型号折线 + 图例点击显隐（满足“让用户选择查看想看的某条折线”）
 * ============================================================ */
(function () {
  'use strict';

  var PALETTE = ['#76b900', '#19b7a8', '#4da3ff', '#f5a623', '#a78bfa', '#ff7ab8'];

  var instances = {};

  function dispose(id) {
    if (instances[id]) { instances[id].dispose(); delete instances[id]; }
  }

  /**
   * 渲染价格折线图
   * @param el       容器 DOM（有固定高度）
   * @param seriesVO {dates, series:[{name,data}], recommend}
   */
  function renderPriceChart(el, seriesVO) {
    if (!window.echarts) {
      el.innerHTML = '<div class="chart-error">图表组件未加载（echarts.min.js 缺失）</div>';
      return null;
    }
    el.classList.remove('skeleton'); // 去掉初始骨架屏动画遮罩
    var id = el.id || ('chart-' + Math.random().toString(36).slice(2));
    dispose(id);
    var chart = echarts.init(el, null, { renderer: 'canvas' });
    instances[id] = chart;

    var max = 0;
    (seriesVO.series || []).forEach(function (s) {
      (s.data || []).forEach(function (v) { if (v != null && v > max) max = v; });
    });
    var yMax = max > 0 ? Math.ceil(max * 1.08) : 100;

    chart.setOption({
      backgroundColor: 'transparent',
      color: PALETTE,
      legend: {
        type: 'scroll',
        top: 0,
        left: 'center',
        icon: 'roundRect',
        itemWidth: 16, itemHeight: 6,
        textStyle: { color: '#a9b3c0', fontSize: 12 },
        pageTextStyle: { color: '#a9b3c0' },
        pageIconColor: '#76b900',
        pageIconInactiveColor: '#2a3340',
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#14181e',
        borderColor: '#313b4a',
        borderWidth: 1,
        textStyle: { color: '#f2f5f8', fontSize: 12.5 },
        padding: [10, 14],
        valueFormatter: function (v) { return v == null ? '--' : '¥' + Number(v).toLocaleString('zh-CN'); },
        axisPointer: { lineStyle: { color: 'rgba(118,185,0,.4)' } },
      },
      grid: { left: 14, right: 22, top: 46, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: seriesVO.dates || [],
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#262e3a' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#6d7888', fontSize: 11,
          interval: Math.max(0, Math.floor(((seriesVO.dates || []).length - 1) / 6)),
        },
      },
      yAxis: {
        type: 'value',
        name: '价格（元）',
        nameTextStyle: { color: '#6d7888', fontSize: 11 },
        max: yMax,
        splitLine: { lineStyle: { color: 'rgba(38,46,58,.6)' } },
        axisLabel: { color: '#6d7888', fontSize: 11, formatter: function (v) { return v >= 1000 ? (v / 1000) + 'k' : v; } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider', height: 18, bottom: 4,
          borderColor: '#262e3a', backgroundColor: '#0f1216',
          fillerColor: 'rgba(118,185,0,.12)',
          handleStyle: { color: '#76b900', borderColor: '#76b900' },
          textStyle: { color: '#6d7888', fontSize: 10 },
          showDetail: false,
        },
      ],
      series: (seriesVO.series || []).map(function (s, i) {
        return {
          name: s.name,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          showSymbol: false,
          lineStyle: { width: 2.4 },
          emphasis: { focus: 'series', lineStyle: { width: 3.5 } },
          data: s.data || [],
          connectNulls: false,
        };
      }),
    });

    chart.on('legendselectchanged', function () {});
    return chart;
  }

  function resizeAll() {
    for (var k in instances) instances[k].resize();
  }
  window.addEventListener('resize', resizeAll);

  window.PriceChart = { render: renderPriceChart, dispose: dispose, resizeAll: resizeAll };
})();
