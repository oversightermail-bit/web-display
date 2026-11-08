/* ============================================================
 * 全局配置（API 切换开关，2026-11 起支持运行时切换）
 *  - 本静态托管包（GitHub Pages）默认 API_MODE = 'mock'：
 *    无需任何后端即可完整演示（价格走势、登录、订阅、AI 问答全部本地模拟）。
 *  - 仅当 localStorage 曾显式切到 'real' 时才走 Java 后端真实数据
 *    （本地后端 http://127.0.0.1:8080 运行时可用）；
 *  - 演示账号 demo / demo123 登录走本地校验并进入演示模式，
 *    退出登录恢复默认模式（DEFAULT_MODE）；
 *  - mode 持久化在 localStorage（hwprice_api_mode），跨页面保持。
 * ============================================================ */
(function () {
  'use strict';

  var LS_MODE = 'hwprice_api_mode';
  var DEFAULT_MODE = 'mock'; // 静态托管默认：本地演示数据（无后端可用）
  var stored = null;
  try { stored = localStorage.getItem(LS_MODE); } catch (e) {}

  var mode = (stored === 'real') ? 'real' : DEFAULT_MODE; // 默认演示模式

  window.AppConfig = {
    API_MODE: mode,
    DEFAULT_MODE: DEFAULT_MODE,
    // 真实后端地址：本地后端默认 8080；file:// 打开页面时直接跨域访问（后端已全放行 CORS）
    API_BASE: 'http://127.0.0.1:8080/api',
    SITE_NAME: '硬核比价',

    /** 切换 API 模式（登录 demo 自动 mock，退出自动 real） */
    setMode: function (m) {
      m = (m === 'mock') ? 'mock' : 'real';
      this.API_MODE = m;
      try { localStorage.setItem(LS_MODE, m); } catch (e) {}
      if (window.MockApi && window.RealApi) {
        window.api = (m === 'mock') ? window.MockApi : window.RealApi;
      }
      if (typeof window.onApiModeChange === 'function') window.onApiModeChange(m);
      return m;
    },
  };
})();
