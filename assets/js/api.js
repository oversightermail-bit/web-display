/* ============================================================
 * api.js —— 统一请求层（双 API 策略）
 *
 *   window.api 根据 AppConfig.API_MODE 选择：
 *   - 'mock'：MockApi —— 内置与后端演示数据同源的数据，纯本地运行（比赛演示）
 *   - 'real'：RealApi —— fetch 调用 Java 后端 REST 接口
 *
 *   两端返回统一格式 {code, message, data}，code=0 成功；
 *   42901 = AI 额度用尽（前端弹升级窗）；40101 = 未登录（前端跳登录页）。
 * ============================================================ */
(function () {
  'use strict';

  var HW = window.HW_DATA || null;
  var LS_USERS = 'hwprice_users';
  var LS_TOKEN = 'hwprice_token';
  var LS_USER = 'hwprice_user';

  /* ======================= Mock 实现 ======================= */
  var MockApi = (function () {
    var PLANS = HW ? HW.plans : [];
    var PLATFORMS = HW ? HW.platforms : ['中关村在线'];
    var DAYS = HW ? HW.days : 30;
    // 性能分随 HW_DATA.products[].perf 而来（与后端 t_product.perf_score 同源，
    // 用于高性价比推荐：指数 = 性能分 ÷ 价格 × 1000）

    function delay(ms) { return UI.sleep(ms || 160 + Math.random() * 180); }
    function ok(data) { return { code: 0, message: 'ok', data: data }; }
    function fail(code, message, data) { return { code: code, message: message, data: data || null }; }

    function readUsers() {
      try { return JSON.parse(localStorage.getItem(LS_USERS)) || {}; }
      catch (e) { return {}; }
    }
    function writeUsers(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); }
    function planById(id) {
      for (var i = 0; i < PLANS.length; i++) if (PLANS[i].id === id) return PLANS[i];
      return PLANS[0];
    }
    function todayDay() { return UI.today(); }
    function todayMonth() { return UI.monthKey(); }
    function refreshUser(u) { // 模拟后端定时任务：日/月额度重置
      var d = todayDay(), m = todayMonth();
      if (u.dayKey !== d) { u.dayKey = d; u.dayUsed = 0; }
      if (u.monthKey !== m) { u.monthKey = m; u.monthUsed = 0; }
      return u;
    }
    function currentUser() {
      var name = localStorage.getItem(LS_USER);
      if (!name) return null;
      var users = readUsers();
      if (!users[name]) return null;
      return refreshUser(users[name]);
    }
    function saveUser(u) {
      var users = readUsers();
      users[u.username] = u;
      writeUsers(users);
    }
    /* 预置演示账号：demo / demo123（免费版）；仅在进入 Mock 模式时生效，
       网页上不展示账号信息，演示账号登录后由 login.js 自动切换到 Mock 模式 */
    function seedDemo() {
      try {
        var users = readUsers();
        if (!users['demo']) {
          users['demo'] = {
            username: 'demo', password: 'demo123', role: 'USER', planId: 1,
            dayUsed: 0, monthUsed: 0, dayKey: todayDay(), monthKey: todayMonth(),
            logs: [], sessions: [], createTime: new Date().toISOString(),
          };
          writeUsers(users);
        }
      } catch (e) {}
    }
    seedDemo();

    /* ---- 数据派生 ---- */
    function productsOf(type) {
      var list = [];
      for (var id in HW.products) if (HW.products[id].type === type) list.push(Object.assign({ id: +id }, HW.products[id]));
      list.sort((a, b) => a.id - b.id);
      return list;
    }
    function dates30() {
      var out = [], d = new Date();
      d.setDate(d.getDate() - (DAYS - 1));
      for (var i = 0; i < DAYS; i++) {
        out.push(d.getFullYear() + '-' + UI.pad(d.getMonth() + 1) + '-' + UI.pad(d.getDate()));
        d.setDate(d.getDate() + 1);
      }
      return out;
    }
    function seriesOfProduct(pid) { // 每日多平台中位价
      var pf = HW.prices[pid], out = [];
      if (!pf) return out;
      for (var d = 0; d < DAYS; d++) {
        var vals = [];
        for (var k = 0; k < PLATFORMS.length; k++) {
          var arr = pf[PLATFORMS[k]];
          if (arr && arr[d] != null) vals.push(arr[d]);
        }
        if (!vals.length) { out.push(null); continue; }
        vals.sort((a, b) => a - b);
        var mid = vals[Math.floor(vals.length / 2)];
        out.push(+mid.toFixed(2));
      }
      return out;
    }
    function todayPlatformPrices(pid) { // 今日价格（按数据源键，当前为 中关村在线）
      var pf = HW.prices[pid], out = {};
      if (!pf) return out;
      for (var k = 0; k < PLATFORMS.length; k++) {
        var arr = pf[PLATFORMS[k]];
        if (arr && arr[DAYS - 1] != null) out[PLATFORMS[k]] = arr[DAYS - 1];
      }
      return out;
    }
    function bestAndSecond(map) {
      var entries = Object.keys(map).map(k => ({ platform: k, price: map[k] }));
      entries.sort((a, b) => a.price - b.price);
      if (!entries.length) return null;
      return {
        platform: entries[0].platform, price: entries[0].price,
        secondPlatform: entries[1] ? entries[1].platform : null,
        secondPrice: entries[1] ? entries[1].price : null,
        diff: entries[1] ? +(entries[1].price - entries[0].price).toFixed(2) : 0,
      };
    }
    function lowestToday(pid) {
      var map = todayPlatformPrices(pid), best = null;
      for (var k in map) if (!best || map[k] < best.price) best = { platform: k, price: map[k] };
      return best;
    }

    /* ---- 模拟 AI（简短大白话） ---- */
    function findModels(content) {
      var hits = [];
      for (var id in HW.products) {
        var p = HW.products[id];
        var model = (p.model || '').toLowerCase();
        var brand = (p.brand || '').toLowerCase();
        var c = (content || '').toLowerCase();
        if (!model) continue;
        // 型号在提问中出现（连续子串或去空格后出现）
        var compact = model.replace(/\s+/g, '');
        if (c.indexOf(model) >= 0 || c.indexOf(compact) >= 0 ||
            (c.indexOf(brand) >= 0 && model.split(/[\s-]+/).filter(t => t.length >= 2).some(t => c.indexOf(t) >= 0))) {
          hits.push(Object.assign({ id: +id }, p));
        }
      }
      return hits;
    }
    function typeKeyword(c) {
      var map = [
        ['cpu', ['cpu', '处理器']], ['gpu', ['gpu', '显卡']],
        ['mem_desktop', ['台式机内存', '内存条', '内存']], ['mem_laptop', ['笔记本内存', '笔电内存']],
        ['ssd', ['固态', 'ssd', 'nvme', 'm.2']], ['ssd_usb', ['移动固态', '移动硬盘固态']],
        ['hdd_usb', ['移动机械', '机械硬盘', '移动硬盘']], ['monitor', ['显示器', '显示屏', '屏幕', '4k', '1080p']],
        ['keyboard', ['键盘']], ['mouse', ['鼠标']],
      ];
      c = c.toLowerCase();
      for (var i = 0; i < map.length; i++) {
        for (var j = 0; j < map[i][1].length; j++) {
          if (c.indexOf(map[i][1][j].toLowerCase()) >= 0) return map[i][0];
        }
      }
      return null;
    }
    function priceLine(pid) {
      var best = lowestToday(pid);
      return best ? (best.platform + ' ' + UI.moneyInt(best.price)) : '暂无数据';
    }
    function aiCompose(content) {
      var models = findModels(content);
      if (models.length >= 2) {
        // 对比：最多 4 个型号
        var lines = [], winner = null;
        models.slice(0, 4).forEach(p => {
          var best = lowestToday(p.id);
          var line = '• ' + p.brand + ' ' + p.model + '（' + p.spec + '）最低 ' +
            (best ? best.platform + ' ' + UI.moneyInt(best.price) : '暂无数据');
          lines.push(line);
          if (best && (!winner || best.price < winner.price)) winner = { p: p, price: best.price };
        });
        var ans = lines.join('\n') + '\n结论：**' + winner.p.brand + ' ' + winner.p.model + '** 今日最低价，比第2低还便宜，先看它。';
        return ans;
      }
      if (models.length === 1) {
        var p = models[0];
        var hw = HW.hardware[p.type] || {};
        var best = lowestToday(p.id);
        var ser = seriesOfProduct(p.id).filter(v => v != null);
        var lo = Math.min.apply(null, ser), hi = Math.max.apply(null, ser);
        return '**' + p.brand + ' ' + p.model + '**（' + p.spec + '）\n今日最低 ' + (best ? best.platform + ' ' + UI.moneyInt(best.price) : '暂无数据') +
          '，近30天 ' + UI.moneyInt(lo) + ' ~ ' + UI.moneyInt(hi) + '。\n一句话：' + (hw.scene || '').split('；')[0] + '。\n避坑提醒：' + (hw.pitfall || '').split('；')[0] + '。';
      }
      // 预算 -> 推荐配置
      var m = content.match(/(\d{4,6})\s*(?:元|块|块钱|rmb)?/i) || content.match(/(\d+(?:\.\d+)?)\s*[kK千]/);
      var budget = m ? +m[1] : 0;
      if (m && content.match(/[kK千]/) && !/元|块/.test(content)) budget = budget * 1000;
      if (budget >= 1000 && budget <= 200000) {
        var laptop = /笔记本|笔电|移动/.test(content);
        var plan = [
          { t: 'cpu', w: .18 }, { t: 'gpu', w: .36, laptopSkip: true },
          { t: laptop ? 'mem_laptop' : 'mem_desktop', w: .07 }, { t: 'ssd', w: .08 },
          { t: 'monitor', w: .12, laptopSkip: true }, { t: 'keyboard', w: .03, laptopSkip: true },
          { t: 'mouse', w: .015, laptopSkip: true },
        ];
        var total = 0, lines = [];
        plan.forEach(it => {
          if (laptop && it.laptopSkip) return;
          var list = productsOf(it.t);
          if (!list.length) return;
          var target = budget * it.w;
          var pick = list[0];
          list.forEach(p => {
            var best = lowestToday(p.id);
            if (best && Math.abs(best.price - target) < Math.abs((lowestToday(pick.id) || { price: 1e9 }).price - target)) pick = p;
          });
          var best = lowestToday(pick.id);
          if (!best) return;
          total += best.price;
          lines.push('• ' + pick.brand + ' ' + pick.model + '（' + pick.spec + '）约 ' + UI.moneyInt(best.price) + '（' + best.platform + '）');
        });
        var head = budget >= 7000 ? '旗舰预算' : (budget >= 3500 ? '主流预算' : '入门预算');
        var tail = laptop ? '\n按上面买，剩下的钱加个大容量移动硬盘备份。' : '\n合计约 ' + UI.moneyInt(total) + '，剩余预算留给机箱、电源和散热。';
        return head + ' ' + UI.moneyInt(budget) + '，推荐：\n' + lines.join('\n') + tail;
      }
      // 硬件类别关键词 -> 概览
      var t = typeKeyword(content);
      if (t) {
        var hw = HW.hardware[t], list = productsOf(t);
        var lo = 1e12, hi = 0, pick = null;
        list.forEach(p => {
          var best = lowestToday(p.id);
          if (!best) return;
          lo = Math.min(lo, best.price); hi = Math.max(hi, best.price);
          if (!pick || best.price < lowestToday(pick.id).price) pick = p;
        });
        return '**' + hw.name + '**：' + (hw.func || '').split('。')[0] + '。\n怎么选：' + (hw.scene || '').split('；')[0] + '。\n今日 ' + list.length + ' 个型号 ' + UI.moneyInt(lo) + ' ~ ' + UI.moneyInt(hi) +
          '，最便宜是 ' + pick.brand + ' ' + pick.model + '。\n坑：' + (hw.pitfall || '').split('；')[0] + '。';
      }
      return '我是装机顾问，说人话版。你可以：\n1）报「预算+用途」，我直接出配置（如：5000元游戏主机）；\n2）报两个型号，我比价格（如：RTX 4060 和 RX 6750 XT）；\n3）问某类硬件的坑（如：固态硬盘怎么选）。\n也可以上传配置单图片，我帮你把关。';
    }

    /* ======================= 接口实现 ======================= */
    return {
      /* 进入 Mock 模式时由登录流程调用：确保演示账号已预置 */
      ensureDemo: function () { seedDemo(); },
      hardware: async function () {
        await delay(200);
        var list = [];
        for (var t in HW.hardware) {
          var ps = productsOf(t), min = null;
          ps.forEach(p => {
            var best = lowestToday(p.id);
            if (best && (min === null || best.price < min)) min = best.price;
          });
          list.push({ type: t, name: HW.hardware[t].name, productCount: ps.length, minPrice: min });
        }
        return ok(list);
      },
      search: async function (keyword) {
        await delay(220);
        var kw = (keyword || '').trim().toLowerCase();
        var products = [], hardware = [];
        if (kw) {
          for (var id in HW.products) {
            var p = HW.products[id];
            var hay = (p.brand + ' ' + p.model + ' ' + p.spec).toLowerCase();
            if (hay.indexOf(kw) >= 0) {
              var best = lowestToday(id);
              products.push({
                id: +id, brand: p.brand, model: p.model, spec: p.spec,
                hardwareType: p.type, typeName: HW.hardware[p.type].name,
                latestPrice: best ? best.price : null, platform: best ? best.platform : null,
              });
            }
          }
          for (var t2 in HW.hardware) {
            if (HW.hardware[t2].name.toLowerCase().indexOf(kw) >= 0 || t2.indexOf(kw) >= 0) {
              hardware.push({ type: t2, name: HW.hardware[t2].name });
            }
          }
        }
        return ok({ keyword: keyword, products: products, hardware: hardware });
      },
      priceContent: async function (type) {
        await delay(180);
        var hw = HW.hardware[type];
        if (!hw) return fail(40401, '未找到该硬件分类');
        return ok({ type: type, name: hw.name, func: hw.func, scene: hw.scene, pitfall: hw.pitfall });
      },
      priceSeries: async function (type) {
        await delay(260);
        if (!HW.hardware[type]) return fail(40401, '未找到该硬件分类');
        var list = productsOf(type), series = [], recommend = [];
        list.forEach(p => {
          series.push({ name: p.brand + ' ' + p.model + '（' + p.spec + '）', data: seriesOfProduct(p.id) });
          var map = todayPlatformPrices(p.id);
          var bs = bestAndSecond(map);
          var price = bs ? bs.price : null;
          var perf = (p.perf != null ? p.perf : 0);
          recommend.push({
            brand: p.brand, model: p.model, spec: p.spec,
            price: price, perf: perf,
            perfBasis: p.perfBasis || '',
            priceDate: price != null ? UI.today() : null,
            // 与后端同口径：性价比指数 = 性能分 ÷ ln(参考价) × 100（对数归一化）
            valueIndex: (perf > 0 && price != null && price > 0)
              ? +(perf / Math.log(price) * 100).toFixed(2) : null,
          });
        });
        return ok({ type: type, name: HW.hardware[type].name, dates: dates30(), series: series, recommend: recommend });
      },

      /* ---- 认证 ---- */
      register: async function (payload) {
        await delay(260);
        var u = (payload.username || '').trim(), p = payload.password || '';
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/.test(u)) return fail(40001, '用户名需 3-20 位，仅限字母/数字/下划线/中文');
        if (p.length < 6 || p.length > 32) return fail(40001, '密码长度需在 6-32 位之间');
        var users = readUsers();
        if (users[u]) return fail(40001, '该用户名已被注册');
        var now = new Date().toISOString();
        users[u] = {
          username: u, password: p, role: 'USER', planId: 1,
          dayUsed: 0, monthUsed: 0, dayKey: todayDay(), monthKey: todayMonth(),
          logs: [], sessions: [], createTime: now,
        };
        writeUsers(users);
        return ok('注册成功');
      },
      login: async function (payload) {
        await delay(260);
        var u = (payload.username || '').trim(), p = payload.password || '';
        var users = readUsers();
        var user = users[u];
        if (!user || user.password !== p) return fail(40101, '用户名或密码不正确');
        user = refreshUser(user);
        saveUser(user);
        var token = 'mock-' + btoa(unescape(encodeURIComponent(u + ':' + Date.now())));
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_USER, u);
        var plan = planById(user.planId);
        return ok({
          token: token, role: user.role, plan: plan.planName,
          quotaRemain: this.quotaView(user, plan),
        });
      },
      quotaView: function (user, plan) {
        var id = plan.id;
        var upgradable = PLANS.filter(p => p.id > id);
        return {
          plan: plan.planName, planId: plan.id,
          dayUsed: user.dayUsed, dayTotal: plan.quotaDay,
          dayRemain: Math.max(0, plan.quotaDay - user.dayUsed),
          dayUnlimited: plan.quotaDay <= 0,
          monthUsed: user.monthUsed, monthTotal: plan.quotaMonth, monthRemain: Math.max(0, plan.quotaMonth - user.monthUsed),
          multimodal: plan.multimodal, expireTime: null, upgradable: upgradable,
        };
      },

      /* ---- 订阅与额度 ---- */
      plans: async function () {
        await delay(150);
        return ok(PLANS.map(p => ({
          id: p.id, planName: p.planName, priceMonth: p.priceMonth,
          quotaDay: p.quotaDay, quotaMonth: p.quotaMonth,
          multimodal: p.multimodal, description: p.description,
        })));
      },
      quota: async function () {
        await delay(160);
        var u = currentUser();
        if (!u) return fail(40101, '未登录或登录已过期');
        var plan = planById(u.planId);
        return ok(this.quotaView(u, plan));
      },
      mySubscription: async function () {
        await delay(150);
        var u = currentUser();
        if (!u) return fail(40101, '未登录或登录已过期');
        var plan = planById(u.planId);
        var exp = null;
        if (u.planId !== 1) { var d = new Date(); d.setDate(d.getDate() + 30); exp = d.toISOString(); }
        return ok({
          subscriptionId: u.planId, planId: plan.id, planName: plan.planName,
          quotaDay: plan.quotaDay, quotaMonth: plan.quotaMonth, multimodal: plan.multimodal,
          startTime: u.createTime, expireTime: exp, status: 1,
        });
      },
      subscribe: async function (planId) {
        await delay(320);
        var u = currentUser();
        if (!u) return fail(40101, '未登录或登录已过期');
        var plan = planById(+planId);
        if (!plan) return fail(40401, '套餐不存在');
        u.planId = plan.id;
        u.dayKey = todayDay(); u.monthKey = todayMonth(); // 切换套餐按新等级口径计
        saveUser(u);
        var exp = null;
        if (plan.id !== 1) { var d = new Date(); d.setDate(d.getDate() + 30); exp = d.toISOString(); }
        return ok({
          subscriptionId: plan.id, planId: plan.id, planName: plan.planName,
          quotaDay: plan.quotaDay, quotaMonth: plan.quotaMonth, multimodal: plan.multimodal,
          startTime: new Date().toISOString(), expireTime: exp, status: 1,
        });
      },
      quotaLogs: async function (page, size) {
        await delay(180);
        var u = currentUser();
        if (!u) return fail(40101, '未登录或登录已过期');
        var logs = (u.logs || []).slice().reverse();
        var total = logs.length;
        page = page || 1; size = size || 20;
        var start = (page - 1) * size;
        return ok({ records: logs.slice(start, start + size), total: total, current: page, size: size });
      },

      /* ---- AI 问答（额度：文本1次 / 图片2次） ---- */
      aiChat: async function (payload) {
        await delay(500);
        var u = currentUser();
        if (!u) return fail(40101, '未登录或登录已过期');
        var content = (payload.content || '').trim();
        var hasImage = !!payload.imageUrl;
        var plan = planById(u.planId);
        if (hasImage && !plan.multimodal) {
          return fail(40301, '当前套餐不支持图片问答，升级基础版即可解锁', { upgradable: PLANS.filter(p => p.id > plan.id) });
        }
        var cost = hasImage ? 2 : 1;
        if ((plan.quotaDay > 0 && u.dayUsed + cost > plan.quotaDay) || u.monthUsed + cost > plan.quotaMonth) {
          return fail(42901, 'AI额度已用完，升级订阅可解锁更多次数',
            { plan: plan.planName, dayRemain: Math.max(0, plan.quotaDay - u.dayUsed), monthRemain: Math.max(0, plan.quotaMonth - u.monthUsed), upgradable: PLANS.filter(p => p.id > plan.id) });
        }
        u.dayUsed += cost; u.monthUsed += cost;
        var sessionId = (u.sessions.length ? Math.max.apply(null, u.sessions) : 0) + 1;
        u.sessions.push(sessionId);
        var answer;
        if (hasImage) {
          answer = '图片收到（本次计 **' + cost + ' 次**额度）。我先按配置单/硬件图帮你把关：先对总价是否在预算内，再重点核对电源功率够不够、机箱装不装得下。把预算数字发我，我直接给你一套更划算的组合。';
        } else {
          answer = aiCompose(content);
        }
        u.logs.push({
          id: u.logs.length + 1, sessionId: sessionId, cost: cost, quotaType: 'AI_CHAT',
          createTime: new Date().toISOString(), sessionInput: content.slice(0, 60),
        });
        saveUser(u);
        return ok({
          answer: answer, cost: cost, sessionId: sessionId,
          dayRemain: Math.max(0, plan.quotaDay - u.dayUsed),
          dayUnlimited: plan.quotaDay <= 0,
          monthRemain: Math.max(0, plan.quotaMonth - u.monthUsed),
        });
      },
    };
  })();

  /* ======================= 真实后端实现 ======================= */
  var RealApi = (function () {
    function BASE() { return AppConfig.API_BASE || '/api'; }
    async function request(path, opt) {
      opt = opt || {};
      var token = localStorage.getItem(LS_TOKEN);
      var headers = Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {},
        token ? { Authorization: 'Bearer ' + token } : {});
      var res;
      try {
        res = await fetch(BASE() + path, Object.assign({}, opt, { headers: headers }));
      } catch (e) {
        return { code: -1, message: '网络异常，请确认后端已启动', data: null };
      }
      if (res.status === 401) {
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
        if (window.location.pathname.indexOf('denlu.html') < 0) {
          window.location.href = '../登录界面/denlu.html';
        }
        return { code: 40101, message: '未登录或登录已过期', data: null };
      }
      try { return await res.json(); }
      catch (e) { return { code: -1, message: '响应解析失败（HTTP ' + res.status + '）', data: null }; }
    }
    function q(params) {
      var s = Object.keys(params).filter(k => params[k] != null).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
      return s ? '?' + s : '';
    }
    return {
      hardware: function () { return request('/public/hardware'); },
      search: function (keyword) { return request('/public/search' + q({ keyword: keyword })); },
      priceContent: function (type) { return request('/public/price/content' + q({ type: type })); },
      priceSeries: function (type) { return request('/public/price/series' + q({ type: type })); },
      register: function (payload) { return request('/public/register', { method: 'POST', body: JSON.stringify(payload) }); },
      login: function (payload) { return request('/public/login', { method: 'POST', body: JSON.stringify(payload) }); },
      plans: function () { return request('/public/subscribe/plans'); },
      quota: function () { return request('/auth/quota'); },
      mySubscription: function () { return request('/auth/subscribe/me'); },
      subscribe: async function (planId) {
        // 支付流程：下单 → （mock 渠道）模拟支付确认 → 激活；
        // 真实支付渠道（alipay/wechat）接入后返回 needsPay，前端弹付款码
        var order = await request('/auth/subscribe/order', { method: 'POST', body: JSON.stringify({ planId: planId }) });
        if (!order || order.code !== 0) return order;
        if (order.data && order.data.mock) {
          return await request('/auth/subscribe/pay/mock/confirm', { method: 'POST', body: JSON.stringify({ orderNo: order.data.orderNo }) });
        }
        return { code: 0, message: '待支付', data: {
          needsPay: true, orderNo: order.data.orderNo, channel: order.data.channel,
          qrContent: order.data.qrContent, payUrl: order.data.payUrl,
          planName: order.data.planName, amount: order.data.amount, status: order.data.status,
        } };
      },
      quotaLogs: function (page, size) { return request('/auth/quota/logs' + q({ page: page || 1, size: size || 20 })); },
      aiChat: function (payload) { return request('/auth/ai/chat', { method: 'POST', body: JSON.stringify(payload) }); },
      /* ---- 管理员接口（仅 ROLE_ADMIN 可调） ---- */
      crawlerStart: function () { return request('/auth/admin/crawler/start', { method: 'POST' }); },
      crawlerStatus: function () { return request('/auth/admin/crawler/status'); },
      crawlerScheduleStart: function () { return request('/auth/admin/crawler/schedule/start', { method: 'POST' }); },
      crawlerScheduleStop: function () { return request('/auth/admin/crawler/schedule/stop', { method: 'POST' }); },
      aiConfig: function () { return request('/auth/admin/ai-config'); },
      saveAiConfig: function (payload) { return request('/auth/admin/ai-config', { method: 'POST', body: JSON.stringify(payload) }); },
      adminUsers: function () { return request('/auth/admin/users'); },
      adminUpdateUser: function (id, payload) { return request('/auth/admin/users/' + id, { method: 'PUT', body: JSON.stringify(payload) }); },
      adminDeleteUser: function (id) { return request('/auth/admin/users/' + id, { method: 'DELETE' }); },
      /* ---- 后端服务管理（仅根管理员 Controler） ---- */
      backendStatus: function () { return request('/auth/admin/backend/status'); },
      backendRestart: function () { return request('/auth/admin/backend/restart', { method: 'POST' }); },
    };
  })();

  window.MockApi = MockApi;
  window.RealApi = RealApi;
  window.api = (AppConfig.API_MODE === 'real') ? RealApi : MockApi;
})();
