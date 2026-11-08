/* ============================================================
 * login.js —— 登录 / 注册页逻辑（F1）
 * 登录成功：保存 JWT 与用户，跳回来源页（或首页）
 * 演示模式（静态托管部署，2026-11 起）：
 *   - 演示账号不在页面展示；手动输入 demo / demo123 登录时
 *     直接走本地 MockApi 校验（无后端也能登录），并保持 mock 演示模式，
 *     顶栏显示"演示模式"徽章；
 *   - 其他账号 / 注册一律走真实后端（本地后端运行时可用；
 *     静态托管无后端时给出明确提示）；
 *   - 退出登录恢复本部署包默认模式（DEFAULT_MODE）。
 * ============================================================ */
(function () {
  'use strict';

  var tabBtns = document.querySelectorAll('.auth-tab');
  var loginForm = document.getElementById('loginForm');
  var regForm = document.getElementById('registerForm');

  function switchTab(tab) {
    tabBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    loginForm.hidden = tab !== 'login';
    regForm.hidden = tab !== 'register';
  }
  tabBtns.forEach(function (b) {
    b.onclick = function () { switchTab(b.dataset.tab); };
  });
  document.getElementById('goRegister').onclick = function (e) { e.preventDefault(); switchTab('register'); };
  document.getElementById('goLogin').onclick = function (e) { e.preventDefault(); switchTab('login'); };

  var params = new URLSearchParams(location.search);
  if (params.get('mode') === 'register') switchTab('register');

  function afterLogin(username) {
    var back = null;
    try { back = sessionStorage.getItem('hwprice_after_login'); } catch (e) {}
    // 演示账号：登录成功即进入 Mock 演示模式（并确保演示数据已预置）
    if (username === 'demo') {
      AppConfig.setMode('mock');
      if (window.MockApi && window.MockApi.ensureDemo) window.MockApi.ensureDemo();
      UI.toast('已进入演示（Mock）模式：页面数据为本地演示数据');
    } else {
      AppConfig.setMode('real');
      UI.toast('登录成功，欢迎回来！');
    }
    setTimeout(function () { location.href = back || '../首页/shouye.html'; }, 700);
  }

  /* 登录：演示账号 demo 走本地 MockApi（无后端可用），其他账号走真实后端校验 */
  loginForm.onsubmit = function (e) {
    e.preventDefault();
    var u = document.getElementById('loginUsername').value.trim();
    var p = document.getElementById('loginPassword').value;
    if (!u) { UI.toast('请输入用户名', 'err'); return; }
    if (!p) { UI.toast('请输入密码', 'err'); return; }
    var btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = '登录中…';
    var isDemo = (u === 'demo');
    var loginApi = isDemo ? window.MockApi : window.RealApi;
    loginApi.login({ username: u, password: p }).then(function (res) {
      if (res.code === 0) {
        Auth.login({ token: res.data.token, user: u, role: res.data.role });
        afterLogin(u);
      } else {
        btn.disabled = false; btn.textContent = '登 录';
        if (res.code === -1 && !isDemo) {
          UI.toast('后端未连接：静态托管环境仅支持演示账号 demo / demo123', 'err');
        } else {
          UI.toast(res.message || '登录失败', 'err');
        }
      }
    });
  };

  /* 注册：一律走真实后端；注册用户使用正常（真实）功能，不进入 mock 模式 */
  regForm.onsubmit = function (e) {
    e.preventDefault();
    var u = document.getElementById('regUsername').value.trim();
    var p = document.getElementById('regPassword').value;
    var p2 = document.getElementById('regPassword2').value;
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/.test(u)) { UI.toast('用户名需 3-20 位，仅限字母/数字/下划线/中文', 'err'); return; }
    if (p.length < 6 || p.length > 32) { UI.toast('密码长度需在 6-32 位之间', 'err'); return; }
    if (p !== p2) { UI.toast('两次输入的密码不一致', 'err'); return; }
    var btn = document.getElementById('regBtn');
    btn.disabled = true; btn.textContent = '注册中…';
    window.RealApi.register({ username: u, password: p }).then(function (res) {
      if (res.code === 0) {
        UI.toast('注册成功，正在自动登录…');
        window.RealApi.login({ username: u, password: p }).then(function (res2) {
          if (res2.code === 0) {
            Auth.login({ token: res2.data.token, user: u, role: res2.data.role });
            afterLogin(u);
          } else {
            switchTab('login');
            document.getElementById('loginUsername').value = u;
            btn.disabled = false; btn.textContent = '注册并登录';
          }
        });
      } else {
        btn.disabled = false; btn.textContent = '注册并登录';
        UI.toast(res.code === -1 ? '后端未连接，注册暂不可用；可先使用演示账号 demo / demo123' : (res.message || '注册失败'), 'err');
      }
    });
  };
})();
