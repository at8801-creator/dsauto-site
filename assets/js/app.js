/* ==========================================================================
   대성오토 랜딩 페이지 로직
   - 데이터: site/data/*.json  (tools/build_site_data.py 가 생성)
   - 설정:   site/config.js
   결과와 가격표는 긴 스크롤이 아니라 전체화면 탭 패널(sheet)로 띄운다.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var D = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ 유틸 */

  // tools/common.py 의 norm_key 와 같은 규칙이어야 합니다.
  var ALIAS = [
    ['쏘나타', '소나타'], ['쏘렌토', '소렌토'], ['쏘랜토', '소렌토'],
    ['쏘울', '소울'], ['쏘올', '소울'], ['그랜져', '그랜저'],
    ['랙스턴', '렉스턴'], ['체어멘', '체어맨'], ['엑티언', '액티언'],
    ['켑티바', '캡티바'], ['윈스텀', '윈스톰'], ['트레일블저', '트레일블레이저'],
    ['아반테', '아반떼'], ['싼타폐', '싼타페'], ['산타페', '싼타페'],
    ['산타모', '싼타모'], ['케스퍼', '캐스퍼'],
    ['6단모하비', '모하비6단'], ['제네시스g80rs3', '제네시스g80rg3']
  ];

  function norm(s) {
    if (s === null || s === undefined) return '';
    var t = String(s).replace(/\s+/g, '').toLowerCase();
    t = t.replace(/[()\[\]/\-_.·,‧'"]+/g, '');
    for (var i = 0; i < ALIAS.length; i++) t = t.split(ALIAS[i][0]).join(ALIAS[i][1]);
    return t;
  }

  function won(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('ko-KR');
  }

  function man(n) {
    if (!n && n !== 0) return '-';
    var v = n / 10000;
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('ko-KR') + '만';
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var p = { event: event };
    if (params) for (var k in params) if (params.hasOwnProperty(k)) p[k] = params[k];
    window.dataLayer.push(p);
  }

  function installGTM(id) {
    if (!id) return;
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ 상태 */

  var S = {
    step: 1, brand: null, car: null, spec: null,
    situ: [], syms: [], gear: null, galIdx: 0, started: false,
    sheet: null, tab: null, histPushed: false
  };

  /* ------------------------------------------------------------- 설정 적용 */

  function applyConfig() {
    var shop = CFG.shop || {}, links = CFG.links || {}, copy = CFG.copy || {};

    $$('[data-shop-name]').forEach(function (n) { if (shop.name) n.textContent = shop.name; });
    $$('[data-shop-tagline]').forEach(function (n) { if (shop.tagline) n.textContent = shop.tagline; });
    $$('[data-shop-phone]').forEach(function (n) { if (shop.phoneLabel) n.textContent = shop.phoneLabel; });

    var addr = $('[data-shop-address]');
    if (addr && shop.address) { addr.textContent = shop.address; addr.hidden = false; }
    var hrs = $('[data-shop-hours]'); if (hrs) hrs.textContent = shop.hours || '';
    var cls = $('[data-shop-closed]'); if (cls) cls.textContent = shop.closed || '';

    Object.keys(copy).forEach(function (k) {
      $$('[data-copy="' + k + '"]').forEach(function (n) { n.textContent = copy[k]; });
    });

    if (shop.logo) {
      var li = $('#logoImg');
      li.src = shop.logo;
      li.hidden = false;
      li.addEventListener('error', function () { li.hidden = true; });
    }
    if (shop.heroImage) {
      findImage(shop.heroImage, function (url) {
        var bg = $('#heroBg');
        bg.style.backgroundImage = 'url("' + url + '")';
        bg.classList.add('has-img');
      });
    }

    var b = CFG.benefit || {};
    var bt = $('[data-benefit-title]'); if (bt) bt.textContent = b.title || '';
    var bn = $('[data-benefit-note]');
    if (bn) { bn.textContent = b.note || ''; bn.hidden = !b.note; }
    var bi = $('[data-benefit-items]');
    if (bi && b.items) b.items.forEach(function (t) { bi.appendChild(el('li', '', esc(t))); });
    var lp = $('[data-lead-privacy]');
    if (lp) lp.textContent = (CFG.lead && CFG.lead.privacyNote) || '';

    var dial = (shop.phoneDial || '').replace(/[^0-9+]/g, '');
    $$('.cta-call').forEach(function (a) { if (dial) { a.href = 'tel:' + dial; a.hidden = false; } });
    ext('.cta-kakao', links.kakaoChat);
    ext('.cta-naver', links.naverReserve);
    ext('.cta-talk', links.naverTalk);
    ext('.cta-blog', links.blog);

    function ext(sel, url) {
      if (!url) return;
      $$(sel).forEach(function (a) {
        a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.hidden = false;
      });
    }

    renderAbout();
    renderHistory();
    renderWarranty();
    renderMap();
    injectSchema();

    if (!$$('.rail .rail-i').some(function (a) { return !a.hidden; })) {
      $('#rail').hidden = true;
      document.body.classList.add('no-rail');
    }
    if (CFG.lead && CFG.lead.mode === 'off') { var lf = $('#leadForm'); if (lf) lf.hidden = true; }
    if (!dial && !links.kakaoChat && !links.naverReserve) setupWarning();

    installGTM((CFG.gtm || {}).containerId);
  }


  /* ---------- 사진 찾기 ----------
     설정에 적힌 경로의 확장자만 바꿔가며 실제로 있는 파일을 찾는다.
     `assets/img/hero.svg` 로 적혀 있어도 hero.jpg 를 넣어두면 그걸 쓴다.
     사진 넣을 때마다 config.js 를 고치지 않아도 되게 하기 위한 것. */
  var PHOTO_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];   // 실제 사진
  var PLACEHOLDER_EXTS = ['.svg'];                       // '준비 중' 자리표시

  // 찾는 순서: 설정에 적힌 경로 -> 다른 사진 확장자 -> 자리표시(svg)
  // 자리표시를 맨 뒤에 두어야 진짜 사진을 넣었을 때 그쪽이 쓰인다.
  function imgCandidates(path) {
    if (!path) return [];
    var dot = path.lastIndexOf('.');
    if (dot < 0) return [path];
    var base = path.slice(0, dot), ext = path.slice(dot).toLowerCase();
    var list = [path];
    PHOTO_EXTS.concat(PLACEHOLDER_EXTS).forEach(function (e) {
      if (e !== ext) list.push(base + e);
    });
    return list;
  }

  // 후보를 차례로 시도해서 처음 성공한 주소를 돌려준다. 전부 실패하면 onFail.
  function findImage(path, onFound, onFail) {
    var list = imgCandidates(path), i = 0;
    (function next() {
      if (i >= list.length) { if (onFail) onFail(); return; }
      var url = list[i++];
      var probe = new Image();
      probe.onload = function () { onFound(url); };
      probe.onerror = next;
      probe.src = url;
    })();
  }

  /* ---------- 회사소개 · 보증 · 오시는 길 ---------- */

  // 값이 비어 있는 줄은 아예 만들지 않는다 (빈칸이 보이면 미완성처럼 보이므로).
  function facts(target, pairs) {
    var dl = $(target);
    if (!dl) return;
    dl.innerHTML = '';
    var n = 0;
    pairs.forEach(function (p) {
      if (!p[1]) return;
      dl.appendChild(el('dt', '', esc(p[0])));
      dl.appendChild(el('dd', '', esc(p[1])));
      n++;
    });
    dl.hidden = n === 0;
  }

  function renderAbout() {
    var a = CFG.about || {}, shop = CFG.shop || {};
    var t = $('[data-about-title]'); if (t) t.textContent = a.title || '회사소개';
    var lead = Array.isArray(a.lead) ? a.lead.join('\n') : (a.lead || '');
    var l = $('[data-about-lead]');
    if (l) { l.textContent = lead; l.hidden = !lead; }
    facts('[data-about-facts]', [
      ['상호', shop.legalName || shop.name], ['대표자', shop.ceo],
      ['설립', shop.since ? shop.since + '년' : ''],
      ['사업자등록번호', shop.bizNo],
      ['전문분야', shop.tagline]
    ]);
  }

  function renderHistory() {
    var list = (CFG.about || {}).history || [];
    var box = $('#hist');
    if (!box) return;
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;

    function row(h) {
      var li = el('li', 'hist-i' + (h.hi ? ' hi' : ''));
      li.innerHTML = '<span class="hist-d">' + esc(h.d) + '</span>' +
                     '<span class="hist-t">' + esc(h.t) + '</span>';
      return li;
    }

    var top = $('#histTop');
    top.innerHTML = '';
    var hi = list.filter(function (h) { return h.hi; });
    (hi.length ? hi : list.slice(-6)).forEach(function (h) { top.appendChild(row(h)); });

    var full = $('#histFull');
    full.innerHTML = '';
    list.forEach(function (h) { full.appendChild(row(h)); });
    $('#histCount').textContent = '전체 연혁 보기 (' + list.length + '건)';

    $('#histAll').addEventListener('toggle', function () {
      if ($('#histAll').open) track('history_open', {});
    });
  }

  function renderWarranty() {
    var w = CFG.warranty || {};
    var sec = $('#warranty');
    if (!w.items || !w.items.length) { if (sec) sec.hidden = true; return; }
    var t = $('[data-warranty-title]'); if (t) t.textContent = w.title || '보증 · A/S';
    var sb = $('[data-warranty-sub]'); if (sb) { sb.textContent = w.sub || ''; sb.hidden = !w.sub; }
    var g = $('[data-warranty-items]');
    g.innerHTML = '';
    w.items.forEach(function (it) {
      g.appendChild(el('div', 'wt',
        (it.badge ? '<span class="wt-b">' + esc(it.badge) + '</span>' : '') +
        '<p class="wt-t">' + esc(it.t) + '</p>' +
        '<p class="wt-d">' + esc(it.d) + '</p>'));
    });
    var n = $('[data-warranty-note]'); if (n) { n.textContent = w.note || ''; n.hidden = !w.note; }
  }

  function renderMap() {
    var shop = CFG.shop || {}, links = CFG.links || {};
    var addr = shop.address ? (shop.address + (shop.addressDetail ? ' ' + shop.addressDetail : '')) : '';
    facts('[data-map-facts]', [
      ['주소', addr], ['전화', shop.phoneLabel],
      ['영업시간', shop.hours], ['휴무', shop.closed],
      ['주차', shop.parking], ['대중교통', shop.transit]
    ]);
    if (shop.mapImage) {
      var wrap = $('.map-wrap');
      findImage(shop.mapImage, function (url) {
        var img = new Image();
        img.src = url;
        var box = el('a', 'map-img');
        box.href = links.naverPlace || '#';
        if (links.naverPlace) { box.target = '_blank'; box.rel = 'noopener'; }
        box.className = 'map-img gtm-cta cta-place';
        box.setAttribute('data-gtm-event', 'naver_place_click');
        box.setAttribute('data-gtm-location', 'map_image');
        box.appendChild(img);
        img.alt = (shop.name || '') + ' 약도';
        wrap.insertBefore(box, wrap.firstChild);
        box.addEventListener('click', function () {
          track('naver_place_click', { location: 'map_image' });
        });
      });
    }
    if (links.naverPlace) {
      var b = $('#gtm-place');
      b.href = links.naverPlace; b.target = '_blank'; b.rel = 'noopener'; b.hidden = false;
    }
    // 주소도 링크도 없으면 섹션 자체를 감춘다
    if (!addr && !links.naverPlace && !shop.phoneLabel) $('#map').hidden = true;
  }

  // 검색엔진에 업체 정보를 알려주는 구조화 데이터.
  // 설정에 실제로 들어 있는 값만 넣는다 (없는 정보를 지어내지 않기 위함).
  function injectSchema() {
    var shop = CFG.shop || {}, links = CFG.links || {};
    if (!shop.name) return;
    var d = { '@context': 'https://schema.org', '@type': 'AutoRepair', name: shop.name };
    if (shop.legalName && shop.legalName !== shop.name) d.legalName = shop.legalName;
    if (shop.tagline) d.description = shop.tagline;
    if (shop.phoneLabel) d.telephone = shop.phoneLabel;
    if (shop.address) {
      d.address = { '@type': 'PostalAddress', addressCountry: 'KR',
                    streetAddress: shop.address + (shop.addressDetail ? ' ' + shop.addressDetail : '') };
    }
    if (location.protocol.indexOf('http') === 0) d.url = location.origin + location.pathname;
    var same = [links.naverPlace, links.blog].filter(Boolean);
    if (same.length) d.sameAs = same;
    var sc = document.createElement('script');
    sc.type = 'application/ld+json';
    sc.textContent = JSON.stringify(d);
    document.head.appendChild(sc);
  }

  // 연락처를 하나도 채우지 않으면 전환 버튼이 전부 사라지므로 눈에 띄게 알린다.
  function setupWarning() {
    var box = el('div', 'blk');
    box.style.cssText = 'border-color:#e2551e;background:#fdf1ec;margin-bottom:20px';
    box.innerHTML = '<p class="blk-h" style="color:#c2440f">설정이 필요합니다</p>' +
      '<p class="blk-s"><code>site/config.js</code> 에서 전화번호 · 네이버 예약 주소 · ' +
      '카카오톡 채널 주소를 채워주세요. 지금은 전환 버튼이 표시되지 않습니다.</p>';
    var w = $('#offer .wrap');
    if (w) w.insertBefore(box, w.firstChild);
    if (window.console) console.warn('[대성오토] config.js 의 shop.phoneDial / links 를 채워주세요.');
  }

  /* ------------------------------------------------------------------ 로드 */

  var FILES = ['catalog', 'cases', 'symptoms', 'menu', 'prices', 'reman', 'samples'];

  function load() {
    // data/data.js 가 먼저 로드되므로 보통은 여기서 끝난다.
    // 이 방식이라야 index.html 을 그냥 더블클릭해서 열어도(file://) 화면이 뜬다.
    if (window.DS_DATA && window.DS_DATA.catalog) {
      FILES.forEach(function (f) { D[f] = window.DS_DATA[f]; });
      return Promise.resolve();
    }
    // data.js 가 없을 때만 JSON 을 직접 읽는다 (서버로 띄운 경우에만 동작).
    return Promise.all(FILES.map(function (f) {
      return fetch('data/' + f + '.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error(f + '.json ' + r.status);
          return r.json();
        })
        .then(function (j) { D[f] = j; });
    }));
  }

  function dataReady() { return !!(D.catalog && D.menu && D.cases); }

  /* ------------------------------------------------------------ 1단계 차종 */

  function renderStepBar() {
    var bar = $('#stepBar');
    bar.innerHTML = '';
    ['차종', '언제', '증상'].forEach(function (lbl, i) {
      var n = i + 1;
      var b = el('button', 'steps-i' + (n === S.step ? ' on' : (n < S.step ? ' done' : '')));
      b.type = 'button';
      b.innerHTML = '<span class="bar"></span><span class="lbl">' + n + '. ' + lbl + '</span>';
      if (n < S.step) b.addEventListener('click', function () { goto(n); });
      bar.appendChild(b);
    });
    $('#stepCount').textContent = S.step + ' / 3';
  }

  function renderBrands() {
    var g = $('#brandGrid');
    g.innerHTML = '';
    D.catalog.forEach(function (grp) {
      if (!grp.cars.length) return;
      var b = el('button', 'brand-b' + (S.brand === grp.brand ? ' on' : ''));
      b.type = 'button';
      b.textContent = grp.brand;
      b.addEventListener('click', function () {
        S.brand = grp.brand; S.car = null; S.spec = null;
        $('#carSearch').value = '';
        renderBrands(); renderCars(); renderSpecs(); syncNav();
        if (!S.started) { S.started = true; track('diagnose_start', {}); }
        track('brand_select', { brand: grp.brand });
      });
      g.appendChild(b);
    });
  }

  function currentCars() {
    var q = norm($('#carSearch').value);
    var pool = [];
    if (q) {
      D.catalog.forEach(function (grp) {
        grp.cars.forEach(function (c) {
          var k = norm(c.name), at = k.indexOf(q);
          if (at === -1) return;
          // 'X5' 를 쳤을 때 '싼타페 MX5' 가 먼저 뜨면 안 된다.
          pool.push({ car: c, brand: grp.brand, rank: (k === q ? 0 : (at === 0 ? 1 : 2)), len: k.length });
        });
      });
      pool.sort(function (a, b) {
        return a.rank - b.rank || a.len - b.len ||
          (a.car.hasPrice === b.car.hasPrice ? 0 : (a.car.hasPrice ? -1 : 1));
      });
    } else if (S.brand) {
      var g = D.catalog.filter(function (x) { return x.brand === S.brand; })[0];
      if (g) g.cars.forEach(function (c) { pool.push({ car: c, brand: g.brand }); });
    } else {
      D.catalog.slice(0, 3).forEach(function (grp) {
        grp.cars.slice(0, 14).forEach(function (c) { pool.push({ car: c, brand: grp.brand }); });
      });
    }
    return pool.slice(0, 400);
  }

  function renderCars() {
    var list = $('#carList');
    list.innerHTML = '';
    var pool = currentCars();
    if (!pool.length) {
      list.appendChild(el('div', 'car-empty', '찾는 차종이 없으면 전화나 카톡으로 물어보셔도 됩니다.'));
      return;
    }
    var showBrand = !!norm($('#carSearch').value) || !S.brand;
    pool.forEach(function (p) {
      var c = p.car;
      var b = el('button', 'car-i' + (S.car && S.car.name === c.name ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.innerHTML = '<span>' + esc(c.name) +
        (showBrand ? ' <span class="bd">' + esc(p.brand) + '</span>' : '') + '</span>' +
        (c.hasPrice ? '<span class="tag">가격 확인</span>' : '<span class="tag gray">상담 안내</span>');
      b.addEventListener('click', function () {
        S.car = c; S.brand = p.brand; S.spec = null;
        renderCars(); renderSpecs(); syncNav();
        track('car_select', { brand: p.brand, car: c.name });
      });
      list.appendChild(b);
    });
  }

  function renderSpecs() {
    var box = $('#specPick'), chips = $('#specChips');
    chips.innerHTML = '';
    var specs = (S.car && S.car.specs) || [];
    if (!specs.length) { box.hidden = true; return; }
    box.hidden = false;
    specs.slice(0, 24).forEach(function (sp) {
      var b = el('button', 'chip' + (S.spec === sp ? ' on' : ''));
      b.type = 'button';
      b.textContent = sp;
      b.addEventListener('click', function () {
        S.spec = (S.spec === sp) ? null : sp;
        renderSpecs();
      });
      chips.appendChild(b);
    });
  }

  /* --------------------------------------------------------- 2·3단계 */

  function renderSitu() {
    var g = $('#situGrid');
    g.innerHTML = '';
    (D.symptoms.situations || []).forEach(function (s) {
      var on = S.situ.indexOf(s.id) !== -1;
      var b = el('button', 'chip' + (on ? ' on' : ''));
      b.type = 'button';
      b.textContent = s.label + (s.hint ? ' (' + s.hint + ')' : '');
      b.addEventListener('click', function () {
        var i = S.situ.indexOf(s.id);
        if (i === -1) S.situ.push(s.id); else S.situ.splice(i, 1);
        renderSitu(); syncNav();
      });
      g.appendChild(b);
    });
  }

  function renderSyms() {
    var g = $('#symGrid');
    g.innerHTML = '';
    var counts = D.symptoms.counts || {};
    (D.symptoms.symptoms || []).forEach(function (s) {
      var on = S.syms.indexOf(s.id) !== -1;
      var b = el('button', 'sym-b' + (on ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var n = counts[s.id];
      b.innerHTML = '<span class="ck"></span><div class="t">' + esc(s.label) + '</div>' +
        '<div class="d">' + esc(s.desc) + '</div>' +
        (n ? '<div class="n">수리 ' + won(n) + '건</div>' : '');
      b.addEventListener('click', function () {
        var i = S.syms.indexOf(s.id);
        if (i === -1) S.syms.push(s.id); else S.syms.splice(i, 1);
        renderSyms(); syncNav();
        track('symptom_select', { symptoms: S.syms.join(',') });
      });
      g.appendChild(b);
    });

    var gc = $('#gearChips');
    gc.innerHTML = '';
    (D.symptoms.gears || []).forEach(function (gear) {
      var b = el('button', 'chip' + (S.gear === gear ? ' on' : ''));
      b.type = 'button';
      b.textContent = gear;
      b.addEventListener('click', function () {
        S.gear = (S.gear === gear) ? null : gear;
        renderSyms();
      });
      gc.appendChild(b);
    });
  }

  function canNext() {
    if (S.step === 1) return !!S.car;
    if (S.step === 2) return S.situ.length > 0;
    if (S.step === 3) return S.syms.length > 0;
    return false;
  }

  function syncNav() {
    $('#btnNext').disabled = !canNext();
    $('#btnNext').textContent = S.step === 3 ? '진단 결과 보기' : '다음';
    $('#btnPrev').hidden = S.step === 1;
  }

  function goto(n) {
    S.step = n;
    $$('.step').forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
    renderStepBar(); syncNav();
    if (n === 2) renderSitu();
    if (n === 3) renderSyms();
  }

  /* ------------------------------------------------------------ 결과 계산 */

  var LABEL = {
    미션오일교환: '미션오일 교환',
    밸브바디정비: '밸브바디 정비 + 오일 교환',
    밸브바디교환: '밸브바디 교환',
    재제조미션교환: '재제조 미션 교환'
  };
  var EXPLAIN = {
    미션오일교환: '오일 오염이 원인인 경우입니다. 오일과 필터, 오일팬을 교환합니다.',
    밸브바디정비: '변속을 제어하는 밸브바디의 압력 이상이 원인입니다. 분해 세척과 압력 보정을 합니다.',
    밸브바디교환: '밸브바디 자체 손상으로 세척만으로는 해결되지 않는 경우입니다.',
    재제조미션교환: '내부 클러치나 기어까지 손상된 경우입니다. 재제조 변속기로 교체합니다.'
  };
  var EMPATHY = {
    변속충격: '기어가 바뀔 때마다 ‘퉁’ 하고 치는 느낌, 신경 쓰이셨을 겁니다.',
    슬립: 'RPM은 올라가는데 차가 안 나가면 불안하실 수밖에 없습니다.',
    변속지연: '기어가 늦게 들어가면 앞차와의 거리 때문에 계속 조심하게 됩니다.',
    소음: '주행 중 ‘웅’ 하는 소리는 대부분 내부에서 나는 신호입니다.',
    진동떨림: '떨림은 참고 타시는 분이 많지만, 원인은 대개 따로 있습니다.',
    누유: '바닥에 기름 자국이 보이면 미루지 않는 게 좋습니다.',
    경고등: '경고등이 들어온 뒤로 운전할 때마다 신경 쓰이셨을 겁니다.',
    기어불량: '특정 단에 고정되면 주행 자체가 불안해집니다.',
    후진불량: '후진이 안 되면 주차할 때마다 곤란하셨을 겁니다.',
    주행불가: '차가 움직이지 않는 상황이면 우선 견인 상담부터 도와드립니다.'
  };
  var MIN_CAR_N = 8;   // 표본이 적으면 구간이 우연히 좁아져 실제보다 싸 보인다.

  function situLabels() {
    return S.situ.map(function (id) {
      var f = ((D.symptoms || {}).situations || []).filter(function (x) { return x.id === id; })[0];
      return f ? f.label : id;
    });
  }

  function symLabels() {
    return S.syms.map(function (id) {
      var f = (D.symptoms.symptoms || []).filter(function (x) { return x.id === id; })[0];
      return f ? f.label : id;
    });
  }

  function computeMix() {
    var acc = {}, used = 0;
    S.syms.forEach(function (s) {
      var e = D.cases.bySymptom[s];
      if (!e || !e.mix) return;
      used++;
      Object.keys(e.mix).forEach(function (t) { acc[t] = (acc[t] || 0) + e.mix[t]; });
    });
    if (!used) return [];
    return Object.keys(acc)
      .map(function (t) { return { type: t, ratio: acc[t] / used }; })
      .filter(function (x) { return x.ratio > 0.01 && LABEL[x.type]; })
      .sort(function (a, b) { return b.ratio - a.ratio; });
  }

  function pickBand(type) {
    var byCar = D.cases.byCar[S.car.name];
    if (byCar && byCar[type] && byCar[type].n >= MIN_CAR_N) {
      return { b: byCar[type], src: S.car.name + ' 실사례 ' + byCar[type].n + '건' };
    }
    var best = null, bestSym = null;
    S.syms.forEach(function (s) {
      var e = D.cases.bySymptom[s];
      if (!e || !e.bands || !e.bands[type]) return;
      if (!best || e.bands[type].n > best.n) { best = e.bands[type]; bestSym = s; }
    });
    if (best) return { b: best, src: '‘' + bestSym + '’ 증상 실사례 ' + best.n + '건' };
    var all = D.cases.repairTypes[type];
    if (all) return { b: all, src: '전체 실사례 ' + all.n + '건' };
    return null;
  }

  function findCategory(carName, spec, brand) {
    var cats = D.menu.categories || [];
    var key = norm((carName || '') + ' ' + (spec || ''));
    var i, c;
    // 가장 긴 키워드가 이긴다 ('제네시스 BH 8단' 은 '제네시스BH' 보다 우선).
    var best = null, bestLen = 0;
    for (i = 0; i < cats.length; i++) {
      c = cats[i];
      var keys = c.match || [];
      for (var j = 0; j < keys.length; j++) {
        var k = keys[j];
        if (k && k.length > bestLen && key.indexOf(k) !== -1) { best = c; bestLen = k.length; }
      }
    }
    if (best) return best;
    for (i = 0; i < cats.length; i++) {
      if ((cats[i].brandMatch || []).indexOf(brand) !== -1) return cats[i];
    }
    var domestic = ['현대', '제네시스', '기아', '쉐보레', 'KG모빌리티', '르노코리아'];
    var isImport = domestic.indexOf(brand) === -1;
    for (i = 0; i < cats.length; i++) {
      if (isImport ? cats[i].isImportDefault : cats[i].isDefault) return cats[i];
    }
    return null;
  }

  function remanFor(carName) {
    var target = norm(carName);
    var keys = Object.keys(D.reman), i;
    for (i = 0; i < keys.length; i++) if (norm(keys[i]) === target) return D.reman[keys[i]];
    for (i = 0; i < keys.length; i++) {
      var k = norm(keys[i]);
      if (k.length >= 2 && (target.indexOf(k) !== -1 || k.indexOf(target) !== -1)) return D.reman[keys[i]];
    }
    return null;
  }

  function pricesFor(carName) {
    var target = norm(carName);
    var keys = Object.keys(D.prices), i;
    for (i = 0; i < keys.length; i++) if (norm(keys[i]) === target) return D.prices[keys[i]];
    for (i = 0; i < keys.length; i++) {
      var k = norm(keys[i]);
      if (k.length >= 2 && target.indexOf(k) !== -1) return D.prices[keys[i]];
    }
    return null;
  }

  /* ═════════════════════════ 전체화면 패널 ═════════════════════════ */

  function openSheet(kind, tabId) {
    var conf = SHEETS[kind];
    if (!conf) return;
    if (!dataReady()) {          // 데이터가 없으면 빈 패널이 뜨는 대신 이유를 알려준다
      alert('가격 데이터를 불러오지 못했습니다.\n\n' +
            'index.html 파일을 직접 열면 브라우저 보안 정책 때문에 데이터를 읽지 못합니다.\n' +
            '실제 서버에 올린 주소로 접속하시거나, site/data/data.js 파일이 있는지 확인해 주세요.');
      return;
    }
    S.sheet = kind;
    var sh = $('#sheet');
    $('#sheetEyebrow').textContent = conf.eyebrow;
    $('#sheetTitle').textContent = typeof conf.title === 'function' ? conf.title() : conf.title;
    $('#sheetRestart').hidden = kind !== 'result';
    $('#sheetAsk').textContent = kind === 'result' ? '문의하기' : '상담 문의';

    var tabs = conf.tabs();
    var bar = $('#sheetTabs');
    bar.innerHTML = '';
    S.tab = tabId && tabs.some(function (t) { return t.id === tabId; }) ? tabId : tabs[0].id;
    tabs.forEach(function (t) {
      var b = el('button', 'sheet-tab' + (t.id === S.tab ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.textContent = t.label;
      b.addEventListener('click', function () { showTab(tabs, t.id); });
      bar.appendChild(b);
    });
    bar.hidden = tabs.length < 2;

    sh.hidden = false;
    document.body.classList.add('locked');
    showTab(tabs, S.tab);
    $('#sheetClose').focus();

    // 패널을 열 때 방문 기록을 하나 쌓아둔다.
    // 이렇게 해야 '뒤로가기'가 사이트를 떠나지 않고 패널만 닫는다.
    if (!S.histPushed) {
      try {
        history.pushState({ dsSheet: kind }, '', location.href);
        S.histPushed = true;
      } catch (e) { /* file:// 등에서 막히면 그냥 넘어간다 */ }
    }

    track('sheet_open', { sheet: kind, tab: S.tab });
  }

  function showTab(tabs, id) {
    S.tab = id;
    $$('#sheetTabs .sheet-tab').forEach(function (b, i) {
      b.className = 'sheet-tab' + (tabs[i].id === id ? ' on' : '');
    });
    restoreLeadForm();          // 폼이 패널 안에 있으면 먼저 빼낸다 (innerHTML 로 지워지면 안 됨)
    var body = $('#sheetBody');
    body.innerHTML = '';
    var pane = el('div', 'sheet-pane');
    body.appendChild(pane);
    var t = tabs.filter(function (x) { return x.id === id; })[0];
    if (t) t.render(pane);
    body.scrollTop = 0;
    track('sheet_tab', { sheet: S.sheet, tab: id });
  }

  // fromBack: 뒤로가기로 닫힌 경우. 이때는 history 를 또 되돌리면 안 된다.
  function closeSheet(fromBack) {
    restoreLeadForm();
    $('#sheet').hidden = true;
    document.body.classList.remove('locked');
    S.sheet = null;
    if (S.histPushed && !fromBack) {
      S.histPushed = false;
      try { history.back(); } catch (e) { /* 무시 */ }
    } else if (fromBack) {
      S.histPushed = false;
    }
  }

  /* ---------------- 패널 정의 ---------------- */

  var SHEETS = {

    /* ===== 진단 결과 ===== */
    result: {
      eyebrow: '자가진단 결과',
      title: function () { return S.car ? S.car.name + (S.spec ? ' · ' + S.spec : '') : '진단 결과'; },
      tabs: function () {
        return [
          { id: 'diag', label: '진단', render: paneDiag },
          { id: 'cost', label: '예상 비용', render: paneCost },
          { id: 'menu', label: '정찰 가격', render: paneMenu },
          { id: 'case', label: '실제 사례', render: paneCase },
          { id: 'ask', label: '문의하기', render: paneAsk }
        ];
      }
    },

    /* ===== 가격표 ===== */
    price: {
      eyebrow: '가격표',
      title: '대성오토 정찰 가격',
      tabs: function () {
        return [
          { id: 'oil', label: '미션오일', render: paneAllOil },
          { id: 'reman', label: '재제조 미션', render: paneAllReman },
          { id: 'maint', label: '경정비', render: paneAllMaint },
          { id: 'diff', label: '디퍼런셜 · 트랜스퍼', render: paneDiff }
        ];
      }
    }
  };

  /* ---------------- 결과 탭 ---------------- */

  function paneDiag(p) {
    var labels = symLabels();
    var head = EMPATHY[S.syms[0]] || '증상을 남겨주셔서 감사합니다. 원인부터 확인해 보겠습니다.';
    var emp = el('div', 'blk empathy');
    emp.innerHTML = '<span class="car">' + esc(S.car.name + (S.spec ? ' · ' + S.spec : '')) + '</span>' +
      '<p class="h">' + esc(head) + '</p>' +
      '<p class="p">같은 증상으로 찾아오신 분들이 실제로 어떤 수리를 받았는지 그대로 보여드립니다.</p>' +
      '<div class="tags">' + labels.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') +
      (S.gear && S.gear !== '잘 모르겠음' ? '<span>' + esc(S.gear) + '</span>' : '') + '</div>';
    p.appendChild(emp);

    var mix = computeMix();
    var symN = S.syms.reduce(function (a, s) {
      var e = D.cases.bySymptom[s]; return a + (e ? e.n : 0);
    }, 0);
    var blk = el('div', 'blk');
    blk.innerHTML = '<p class="blk-h">이 증상으로 실제 진행된 수리</p>' +
      '<p class="blk-s">' + esc(labels.join(' · ')) + ' 증상으로 입고된 ' + won(symN) + '건 집계</p>';
    if (!mix.length) {
      blk.appendChild(el('p', 'blk-s', '이 조합은 사례가 적어 비중을 보여드리기 어렵습니다. 점검으로 확인이 필요합니다.'));
    }
    mix.forEach(function (m) {
      var row = el('div', 'cb-row');
      row.innerHTML = '<div class="cb-top"><span class="cb-name">' + esc(LABEL[m.type]) + '</span>' +
        '<span class="cb-pct">' + Math.round(m.ratio * 100) + '%</span></div>' +
        '<div class="cb-track"><i class="cb-fill" style="width:0"></i></div>' +
        '<div class="cb-note">' + esc(EXPLAIN[m.type] || '') + '</div>';
      blk.appendChild(row);
      requestAnimationFrame(function () {
        $('.cb-fill', row).style.width = Math.max(3, Math.round(m.ratio * 100)) + '%';
      });
    });
    blk.appendChild(el('p', 'disclaimer',
      '증상이 같아도 분해 후 확인되는 상태에 따라 실제 수리는 달라집니다. 위 비중은 확률이 아니라 과거 실적입니다.'));
    p.appendChild(blk);
  }

  function paneCost(p) {
    var mix = computeMix();
    var order = mix.length ? mix.map(function (m) { return m.type; })
      : ['미션오일교환', '밸브바디정비', '재제조미션교환'];
    var maxP75 = 1;
    order.forEach(function (t) { var r = pickBand(t); if (r) maxP75 = Math.max(maxP75, r.b.p75); });

    var head = el('div', 'blk');
    head.innerHTML = '<p class="blk-h">수리 방법별 실제 청구액</p>' +
      '<p class="blk-s">견적서가 아니라 ' + won((D.cases.meta || {})['가격있는사례']) +
      '건의 실제 청구 내역에서 뽑은 금액대입니다.</p>';
    p.appendChild(head);

    order.forEach(function (t, i) {
      var r = pickBand(t);
      if (!r) return;
      var b = r.b;
      var left = (b.p25 / maxP75) * 100, width = ((b.p75 - b.p25) / maxP75) * 100;
      var card = el('div', 'est' + (i === 0 ? ' top' : ''));
      card.innerHTML =
        '<div class="est-top"><span class="est-rank">' +
        (i === 0 ? '가장 많은 경우' : i + 1 + '순위') + '</span>' +
        '<span class="est-name">' + esc(LABEL[t]) + '</span></div>' +
        '<div class="est-range">' + man(b.p25) + ' ~ ' + man(b.p75) + '원</div>' +
        '<div class="est-mid">절반이 이 구간이며 중간값은 ' + won(b.p50) + '원입니다. ' +
        '가장 적은 경우 ' + man(b.min) + '원, 가장 많은 경우 ' + man(b.max) + '원.</div>' +
        '<div class="est-bar"><i style="left:' + left.toFixed(1) + '%;width:' +
        Math.max(width, 2).toFixed(1) + '%"></i></div>' +
        '<div class="est-src">근거: ' + esc(r.src) + '</div>';
      p.appendChild(card);
    });

    p.appendChild(el('p', 'disclaimer',
      '위 금액은 실제로 청구된 금액의 분포이며 견적서가 아닙니다. ' +
      '같은 증상이라도 분해 후 확인되는 상태에 따라 달라집니다. 정확한 금액은 무상 점검 후 알려드립니다.'));
  }

  function paneMenu(p) {
    var cat = findCategory(S.car.name, S.spec, S.brand);
    if (cat) p.appendChild(menuBlock(cat, '이 차량 미션오일 교환 정찰 가격'));

    var rm = remanFor(S.car.name);
    if (rm && rm.length) {
      var blk = el('div', 'blk');
      blk.innerHTML = '<p class="blk-h">이 차량 재제조 미션 가격</p>';
      rm.forEach(function (x) {
        blk.appendChild(el('div', 'mrow',
          '<span class="mn">' + esc(x.mission) + '</span><span class="mp">' + won(x.price) + '원</span>'));
      });
      blk.appendChild(el('p', 'mnote',
        '재제조 미션은 사양에 따라 가격이 다릅니다. 차대번호를 알려주시면 정확한 사양으로 안내드립니다.'));
      p.appendChild(blk);
    }

    var pr = pricesFor(S.car.name);
    if (pr) {
      var key = S.spec && pr[S.spec] ? S.spec : Object.keys(pr)[0];
      var v = pr[key];
      var mb = el('div', 'blk');
      mb.innerHTML = '<p class="blk-h">이 차량 경정비 정찰 가격</p>' +
        '<p class="blk-s">' + esc(S.car.name + (key && key !== '-' ? ' · ' + key : '')) + '</p>';
      [['엔진오일패키지', '엔진오일 (오일+오일필터+에어크리너)'],
       ['에어컨필터', '에어컨필터'], ['에어컨가스', '에어컨가스'],
       ['브레이크디스크프론트', '브레이크 디스크 / 프론트'],
       ['브레이크디스크리어', '브레이크 디스크 / 리어'],
       ['브레이크패드프론트', '브레이크 패드 / 프론트'],
       ['브레이크패드리어', '브레이크 패드 / 리어'],
       ['브레이크오일', '브레이크 오일']].forEach(function (pair) {
        if (!v[pair[0]]) return;
        mb.appendChild(el('div', 'mrow',
          '<span class="mn">' + esc(pair[1]) + '</span><span class="mp">' + won(v[pair[0]]) + '원</span>'));
      });
      p.appendChild(mb);
    }

    if (!cat && !(rm && rm.length) && !pr) {
      p.appendChild(el('p', 'pane-empty', '이 차량은 정찰 가격이 등록되어 있지 않습니다. 상담으로 안내드립니다.'));
    }
  }

  function menuBlock(cat, title) {
    var blk = el('div', 'blk');
    blk.innerHTML = '<p class="blk-h">' + esc(title || cat.name) + '</p>' +
      '<p class="blk-s">' + esc(cat.name) + (cat.applies ? ' — ' + esc(cat.applies) : '') + '</p>';
    (cat.items || []).forEach(function (it) {
      blk.appendChild(el('div', 'mrow',
        '<span class="mn">' + esc(it.name) + '</span><span class="mp">' +
        (it.price ? won(it.price) + '원' : '문의') + '</span>'));
    });
    (cat.labor || []).forEach(function (it) {
      blk.appendChild(el('div', 'mrow labor',
        '<span class="mn">' + esc(it.name) + '</span><span class="mp">' +
        (it.price ? won(it.price) + '원' : '문의') + '</span>'));
    });
    (cat.notes || []).forEach(function (n) { blk.appendChild(el('p', 'mnote', esc(n))); });
    return blk;
  }

  // 상담 폼은 페이지에 하나만 둔다. 문의하기 탭에서는 그 폼을 패널 안으로 옮겨 오고,
  // 탭을 벗어나거나 패널을 닫으면 원래 자리로 돌려놓는다.
  // (복제하지 않으므로 입력하던 내용과 이벤트가 그대로 유지된다)
  function paneAsk(p) {
    var form = $('#leadForm');
    if (!form) {
      p.appendChild(el('p', 'pane-empty', '상담 폼이 꺼져 있습니다. 전화로 문의해 주세요.'));
      return;
    }
    var blk = el('div', 'blk');
    blk.innerHTML = '<p class="blk-h">진단 내용 그대로 문의 남기기</p>' +
      '<p class="blk-s">방금 고르신 차종과 증상이 아래에 채워져 있습니다. ' +
      '성함과 연락처만 남겨주시면 확인 후 연락드립니다.</p>';
    blk.appendChild(form);
    p.appendChild(blk);
    fillLeadFromDiag();
    var n = $('#leadName');
    if (n && !n.value) setTimeout(function () { n.focus(); }, 120);
  }

  function restoreLeadForm() {
    var form = $('#leadForm'), home = $('#leadHome');
    if (form && home && form.parentNode !== home) home.appendChild(form);
  }

  // 자가진단에서 고른 내용을 폼에 그대로 채워 넣는다.
  function fillLeadFromDiag() {
    if (!S.car) return;
    var car = $('#leadCar'), sym = $('#leadSymptom');
    var carTxt = S.car.name + (S.spec ? ' ' + S.spec : '');
    if (car && (!car.value || car.dataset.auto === '1')) {
      car.value = carTxt;
      car.dataset.auto = '1';
    }
    var symTxt = symLabels().join(', ') +
      (S.gear && S.gear !== '잘 모르겠음' ? ' (' + S.gear + ')' : '');
    if (sym && (!sym.value || sym.dataset.auto === '1')) {
      sym.value = symTxt;
      sym.dataset.auto = '1';
    }
  }

  function paneCase(p) {
    var picked = (D.samples || []).filter(function (s) {
      return norm(s.car) === norm(S.car.name) &&
        s.syms.some(function (x) { return S.syms.indexOf(x) !== -1; });
    });
    var more = (D.samples || []).filter(function (s) {
      return picked.indexOf(s) === -1 && s.syms.some(function (x) { return S.syms.indexOf(x) !== -1; });
    });
    var list = picked.concat(more).slice(0, 12);
    var blk = el('div', 'blk');
    blk.innerHTML = '<p class="blk-h">최근 같은 증상 수리 사례</p>' +
      '<p class="blk-s">고객 정보는 담지 않고 차종 · 주행거리 · 증상 · 청구액만 표시합니다.</p>';
    if (!list.length) {
      blk.appendChild(el('p', 'pane-empty', '표시할 사례가 없습니다.'));
    }
    list.forEach(function (s) {
      blk.appendChild(el('div', 'sample',
        '<div><div class="s1">' + esc(s.car) + ' · ' + esc((s.syms || []).join(', ')) + '</div>' +
        '<div class="s2">' + (s.ym ? esc(s.ym) + ' · ' : '') +
        (s.km ? '약 ' + s.km + '만km · ' : '') + esc(LABEL[s.type] || s.type) + '</div></div>' +
        '<div class="r">' + won(s.price) + '원</div>'));
    });
    p.appendChild(blk);
  }

  /* ---------------- 전체 가격표 탭 ---------------- */

  function paneAllOil(p) {
    var groups = {};
    (D.menu.categories || []).forEach(function (c) {
      (groups[c.group || '기타'] = groups[c.group || '기타'] || []).push(c);
    });
    Object.keys(groups).forEach(function (g) {
      var blk = el('div', 'blk');
      blk.innerHTML = '<p class="blk-h">' + esc(g) + '</p>';
      groups[g].forEach(function (c) {
        var box = el('div', 'mcat');
        box.innerHTML = '<div class="mcat-n">' + esc(c.name) + '</div>' +
          (c.applies ? '<div class="mcat-a">' + esc(c.applies) + '</div>' : '');
        (c.items || []).forEach(function (it) {
          box.appendChild(el('div', 'mrow',
            '<span class="mn">' + esc(it.name) + '</span><span class="mp">' +
            (it.price ? won(it.price) + '원' : '문의') + '</span>'));
        });
        (c.labor || []).forEach(function (it) {
          box.appendChild(el('div', 'mrow labor',
            '<span class="mn">' + esc(it.name) + '</span><span class="mp">' +
            (it.price ? won(it.price) + '원' : '문의') + '</span>'));
        });
        (c.notes || []).forEach(function (n) { box.appendChild(el('p', 'mnote', esc(n))); });
        blk.appendChild(box);
      });
      p.appendChild(blk);
    });
  }

  function searchableList(p, placeholder, entries, renderRow, emptyHtml) {
    var box = el('div', 'blk');
    var lab = el('label', 'srch tbl-srch');
    lab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 015.9 13.4l5.4 5.3-1.4 1.4-5.4-5.3A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z" fill="#868e9a"/></svg>' +
      '<input type="search" placeholder="' + esc(placeholder) + '" autocomplete="off">';
    var holder = el('div');
    box.appendChild(lab);
    box.appendChild(holder);
    p.appendChild(box);

    function draw(q) {
      holder.innerHTML = '';
      var nq = norm(q);
      var hits = entries.filter(function (e) { return !nq || norm(e.key).indexOf(nq) !== -1; });
      if (!hits.length) {
        holder.appendChild(el('div', 'pane-empty',
          emptyHtml || '검색 결과가 없습니다.'));
        return;
      }
      hits.slice(0, 60).forEach(function (e) { renderRow(holder, e); });
      if (hits.length > 60) {
        holder.appendChild(el('p', 'mnote', '검색 결과가 많습니다. 차종을 더 정확히 입력해 주세요. (' +
          hits.length + '건 중 60건 표시)'));
      }
    }
    $('input', lab).addEventListener('input', function (e) { draw(e.target.value); });
    draw('');
  }

  function paneAllReman(p) {
    var entries = Object.keys(D.reman).map(function (car) { return { key: car, car: car }; })
      .sort(function (a, b) { return a.car.localeCompare(b.car, 'ko'); });
    searchableList(p, '차종 검색 (예: 그랜저, 모하비)', entries, function (holder, e) {
      var box = el('div', 'mcat');
      box.innerHTML = '<div class="mcat-n">' + esc(e.car) + '</div>';
      D.reman[e.car].forEach(function (x) {
        box.appendChild(el('div', 'mrow',
          '<span class="mn">' + esc(x.mission) + '</span><span class="mp">' + won(x.price) + '원</span>'));
      });
      holder.appendChild(box);
    },
    '이 차종은 재제조 미션 가격이 아직 등록되어 있지 않습니다.<br>' +
    '보유 사양이 많아 개별 안내가 필요합니다 — 카톡이나 전화로 차대번호를 알려주시면 바로 확인해 드립니다.');
  }

  function paneAllMaint(p) {
    var ITEMS = [['엔진오일패키지', '엔진오일 (오일+필터+에어크리너)'],
                 ['에어컨필터', '에어컨필터'], ['에어컨가스', '에어컨가스'],
                 ['브레이크디스크프론트', '디스크 / 프론트'], ['브레이크디스크리어', '디스크 / 리어'],
                 ['브레이크패드프론트', '패드 / 프론트'], ['브레이크패드리어', '패드 / 리어'],
                 ['브레이크오일', '브레이크 오일']];
    var entries = [];
    Object.keys(D.prices).forEach(function (car) {
      Object.keys(D.prices[car]).forEach(function (spec) {
        entries.push({ key: car + ' ' + spec, car: car, spec: spec, v: D.prices[car][spec] });
      });
    });
    searchableList(p, '차종 검색 (예: 그랜저 HG)', entries, function (holder, e) {
      var box = el('div', 'mcat');
      box.innerHTML = '<div class="mcat-n">' + esc(e.car) +
        (e.spec && e.spec !== '-' ? ' <span class="mcat-a" style="display:inline">' + esc(e.spec) + '</span>' : '') + '</div>';
      ITEMS.forEach(function (pair) {
        if (!e.v[pair[0]]) return;
        box.appendChild(el('div', 'mrow',
          '<span class="mn">' + esc(pair[1]) + '</span><span class="mp">' + won(e.v[pair[0]]) + '원</span>'));
      });
      holder.appendChild(box);
    });
  }

  function paneDiff(p) {
    var blk = el('div', 'blk');
    blk.innerHTML = '<p class="blk-h">디퍼런셜 · 트랜스퍼 오일</p>' +
      '<p class="blk-s">공임은 오일을 직접 가져오실 때 받는 금액입니다.</p>';
    (D.menu.diff || []).forEach(function (d) {
      var box = el('div', 'mcat');
      box.innerHTML = '<div class="mcat-n">' + esc(d['이름']) + '</div>' +
        (d['적용'] ? '<div class="mcat-a">적용: ' + esc(d['적용']) + '</div>' : '');
      box.appendChild(el('div', 'mrow',
        '<span class="mn">교환 (오일 포함)</span><span class="mp">' +
        (d.price ? won(d.price) + '원' : '문의') + '</span>'));
      if (d['공임']) {
        box.appendChild(el('div', 'mrow labor',
          '<span class="mn">오일 지참 시 공임</span><span class="mp">' + won(d['공임']) + '원</span>'));
      }
      if (d['안내']) box.appendChild(el('p', 'mnote', esc(d['안내'])));
      blk.appendChild(box);
    });
    p.appendChild(blk);
  }

  /* ------------------------------------------------------------- 결과 열기 */

  function showResult() {
    $('#leadCtx').textContent = '보내실 내용: ' + S.car.name + (S.spec ? ' ' + S.spec : '') +
      ' / ' + symLabels().join(', ') + (S.gear && S.gear !== '잘 모르겠음' ? ' / ' + S.gear : '');
    fillLeadFromDiag();
    var mix = computeMix();
    fillLeadFromDiag();
    openSheet('result', 'diag');
    track('diagnose_complete', {
      brand: S.brand, car: S.car.name, spec: S.spec || '',
      symptoms: S.syms.join(','), situations: S.situ.join(','),
      gear: S.gear || '', top_repair: (mix[0] || {}).type || ''
    });
  }

  /* ------------------------------------------------------------- 갤러리 */

  function renderGallery() {
    var items = CFG.gallery || [];
    var tr = $('#galTrack'), dots = $('#galDots');
    tr.innerHTML = ''; dots.innerHTML = '';
    items.forEach(function (g, i) {
      var it = el('div', 'gal-item');
      it.innerHTML = '<div class="gal-ph"><span class="num">' + esc(g.step) + '</span>' +
        '<img alt="' + esc(g.title) + '" loading="lazy">' +
        '<span class="ph-txt" hidden>사진 준비 중</span></div>' +
        '<div class="gal-txt"><div class="t">' + esc(g.title) + '</div>' +
        '<div class="d">' + esc(g.desc) + '</div></div>';
      var img = $('img', it);
      img.hidden = true;
      findImage(g.file, function (url) {
        img.src = url;
        img.hidden = false;
        $('.ph-txt', it).hidden = true;
      }, function () {
        $('.ph-txt', it).hidden = false;   // 사진이 하나도 없으면 자리표시
      });
      tr.appendChild(it);
      var d = el('button');
      d.type = 'button';
      d.className = i === 0 ? 'on' : '';
      d.setAttribute('aria-label', (i + 1) + '번째 사진');
      d.addEventListener('click', function () { galGo(i); });
      dots.appendChild(d);
    });
  }

  function galPer() {
    var w = window.innerWidth;
    return w >= 1000 ? 3 : (w >= 768 ? 2 : 1);
  }

  function galGo(i) {
    var items = CFG.gallery || [];
    if (!items.length) return;
    var per = galPer();
    var max = Math.max(0, items.length - per);
    S.galIdx = Math.max(0, Math.min(i, max));
    $('#galTrack').style.transform = 'translateX(' + (-S.galIdx * (100 / per)) + '%)';
    $$('#galDots button').forEach(function (d, k) { d.className = k === S.galIdx ? 'on' : ''; });
  }

  /* ------------------------------------------------------------- 폼 전송 */

  function fmtPhone(v) {
    var d = v.replace(/[^0-9]/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }

  function leadMessage(f) {
    return '[홈페이지 상담요청]\n성함: ' + f.name + '\n연락처: ' + f.phone +
      '\n차량번호: ' + f.plate +
      '\n차종: ' + f.car +
      '\n증상: ' + f.symptom +
      (S.gear && S.gear !== '잘 모르겠음' ? '\n변속단: ' + S.gear : '') +
      '\n무상 정밀점검 예약을 원합니다.';
  }

  function isMobile() { return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent); }

  // 진단에서 고른 차종 · 증상을 폼에 미리 채운다.
  // 손님이 직접 고쳐 쓴 칸(data-typed)은 덮어쓰지 않는다.
  function fillLeadFromDiag() {
    var carEl = $('#leadCar'), symEl = $('#leadSymptom');
    if (carEl && !carEl.dataset.typed && S.car) {
      carEl.value = S.car.name + (S.spec ? ' ' + S.spec : '');
      carEl.setAttribute('aria-invalid', 'false');
    }
    if (symEl && !symEl.dataset.typed) {
      var t = symLabels().join(', ');
      if (S.gear && S.gear !== '잘 모르겠음') t += ' (' + S.gear + ')';
      if (t) { symEl.value = t; symEl.setAttribute('aria-invalid', 'false'); }
    }
  }

  // 폼 다섯 칸을 한 번에 읽는다.
  function readLead() {
    var f = {
      nameEl:    $('#leadName'),
      phoneEl:   $('#leadPhone'),
      plateEl:   $('#leadPlate'),
      carEl:     $('#leadCar'),
      symptomEl: $('#leadSymptom')
    };
    f.name    = f.nameEl.value.trim();
    f.phone   = f.phoneEl.value.trim();
    f.plate   = f.plateEl.value.trim().toUpperCase();
    f.car     = f.carEl.value.trim();
    f.symptom = f.symptomEl.value.trim().replace(/[\s\n]+/g, ' ');
    f.digits  = f.phone.replace(/[^0-9]/g, '');
    return f;
  }

  function submitLead(e) {
    e.preventDefault();
    var msg = $('#leadMsg');
    var f = readLead();

    // 한 칸이라도 비면 빨간 테두리를 두르고 첫 빈 칸으로 커서를 옮긴다.
    var checks = [
      { el: f.nameEl,    ok: !!f.name },
      { el: f.phoneEl,   ok: f.digits.length >= 9 },
      { el: f.plateEl,   ok: !!f.plate },
      { el: f.carEl,     ok: !!f.car },
      { el: f.symptomEl, ok: !!f.symptom }
    ];
    var bad = null;
    checks.forEach(function (c) {
      c.el.setAttribute('aria-invalid', c.ok ? 'false' : 'true');
      if (!c.ok && !bad) bad = c.el;
    });
    if (bad) {
      msg.className = 'lead-msg err';
      msg.textContent = '성함 · 연락처 · 차량번호 · 차종 · 증상을 모두 입력해 주세요.';
      try { bad.focus(); } catch (err) { }
      return;
    }

    var lead = CFG.lead || {};
    var mode = lead.mode || 'auto';
    if (mode === 'auto') mode = isMobile() ? 'sms' : 'kakao';
    var text = leadMessage(f);
    var dial = ((CFG.shop || {}).phoneDial || '').replace(/[^0-9+]/g, '');

    track('lead_submit', { brand: S.brand, car: f.car, symptoms: f.symptom, method: mode });

    // 시트 주소가 있으면 그걸로 접수를 끝낸다. (엑셀로 내려받을 수 있는 유일한 경로)
    // 주소가 없을 때만 문자·카톡으로 넘겨서 접수가 아예 유실되지 않게 한다.
    if (lead.sheetUrl) {
      fetch(lead.sheetUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          name: f.name, phone: f.phone, plate: f.plate, car: f.car, symptom: f.symptom,
          brand: S.brand || '', pickedCar: S.car ? S.car.name : '', spec: S.spec || '',
          situations: situLabels().join(', '), symptoms: symLabels().join(', '),
          gear: S.gear || '',
          page: location.href, ref: document.referrer, ts: new Date().toISOString()
        })
      }).catch(function () { });
      ok(msg, '접수되었습니다. 확인 후 곧 연락드리겠습니다.');
      markSubmitted();
      return;
    }
    if (mode === 'sheet') {          // 시트를 쓰겠다고 해놓고 주소가 없는 경우
      msg.className = 'lead-msg err';
      msg.textContent = '접수 설정이 아직 되어 있지 않습니다. 전화로 문의해 주세요.';
      return;
    }
    if (mode === 'sms' && dial) {
      var sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
      location.href = 'sms:' + dial + sep + 'body=' + encodeURIComponent(text);
      ok(msg, '문자 앱이 열립니다. 전송 버튼만 눌러주세요.');
      return;
    }
    var kakao = (CFG.links || {}).kakaoChat;
    if (kakao) {
      copy(text);
      window.open(kakao, '_blank', 'noopener');
      ok(msg, '카카오톡 상담창이 열렸습니다. 내용이 복사되어 있으니 붙여넣기만 하시면 됩니다.');
      return;
    }
    if (dial) { location.href = 'tel:' + dial; return; }
    msg.className = 'lead-msg err';
    msg.textContent = '상담 연결 설정이 아직 되어 있지 않습니다. 전화로 문의해 주세요.';
  }

  function ok(msg, text) { msg.className = 'lead-msg ok'; msg.textContent = text; }

  // 접수 뒤 같은 내용을 여러 번 보내지 않도록 버튼을 잠근다.
  function markSubmitted() {
    var b = $('#gtm-lead-submit');
    if (!b) return;
    b.disabled = true;
    b.textContent = '접수 완료';
    setTimeout(function () { b.disabled = false; b.textContent = '상담 요청 보내기'; }, 8000);
  }

  function copy(text) {
    try { if (navigator.clipboard) { navigator.clipboard.writeText(text); return; } } catch (e) { }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e2) { }
    document.body.removeChild(ta);
  }

  /* ------------------------------------------------------------- 통계 */

  function renderStats() {
    var m = D.cases.meta || {}, rt = D.cases.repairTypes || {};
    var shop = CFG.shop || {};
    var cars = 0;
    (D.catalog || []).forEach(function (g) { cars += g.cars.length; });

    // 집계 자료는 최근 몇 해 기록뿐이다. 회사 전체 실적처럼 보이면 오히려 실제보다
    // 작아 보이므로, 기간을 라벨에 분명히 적는다.
    var period = m['기간'] || '';
    var span = period ? period.replace('~', '~') + '년' : '최근';

    $('#ptCases').textContent = won(m['출고완료건수'] || 0) + '건';
    $('#ptCars').textContent = won(cars) + '종';

    var data = [];
    if (shop.since) {
      var yrs = new Date().getFullYear() - parseInt(shop.since, 10);
      if (yrs > 0 && yrs < 100) data.push({ v: yrs + '년', k: shop.since + '년부터 이어온 업력' });
    }
    data.push(
      { v: won(m['출고완료건수'] || 0) + '건', k: span + ' 출고 완료 내역' },
      { v: won(Object.keys(D.cases.byCar || {}).length) + '종', k: '수리 이력이 있는 차종' },
      { v: won(cars) + '종', k: '진단 가능 차종' },
      { v: won((rt['재제조미션교환'] || {}).n || 0) + '건', k: span + ' 재제조 미션 교환' }
    );
    var g = $('#stats');
    g.innerHTML = '';
    data.forEach(function (d) {
      g.appendChild(el('div', 'stat', '<div class="v">' + esc(d.v) + '</div><div class="k">' + esc(d.k) + '</div>'));
    });

    var note = period
      ? '아래 숫자는 ' + period + '년 기록만 집계한 것입니다. 그 이전 실적은 포함되어 있지 않습니다.'
      : (m['설명'] || '');
    $('#statsNote').textContent = note + ' 개인정보는 포함되지 않습니다.';
  }

  /* ------------------------------------------------------------- 바인딩 */

  function resetDiag() {
    S.brand = null; S.car = null; S.spec = null; S.situ = []; S.syms = []; S.gear = null;
    $('#carSearch').value = '';
    $('#specPick').hidden = true;
    renderBrands(); renderCars(); goto(1);
  }

  function bind() {
    $('#btnNext').addEventListener('click', function () {
      if (!canNext()) return;
      if (S.step === 3) { showResult(); return; }
      track('diagnose_step', { step: S.step });
      goto(S.step + 1);
    });
    $('#btnPrev').addEventListener('click', function () { goto(Math.max(1, S.step - 1)); });
    $('#carSearch').addEventListener('input', function () { renderCars(); });

    $('#galPrev').addEventListener('click', function () { galGo(S.galIdx - 1); });
    $('#galNext').addEventListener('click', function () { galGo(S.galIdx + 1); });
    window.addEventListener('resize', function () { galGo(S.galIdx); });

    $('#leadForm').addEventListener('submit', submitLead);
    $('#leadPhone').addEventListener('input', function (e) { e.target.value = fmtPhone(e.target.value); });
    ['#leadName', '#leadPhone', '#leadPlate', '#leadCar', '#leadSymptom'].forEach(function (sel) {
      var el2 = $(sel);
      if (!el2) return;
      el2.addEventListener('input', function () {
        el2.dataset.typed = '1';
        if (el2.value.trim()) el2.setAttribute('aria-invalid', 'false');
      });
    });

    // 헤더 모바일 메뉴
    var burger = $('#burger'), mob = $('#hdMobile');
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', open ? 'false' : 'true');
      mob.hidden = open;
    });
    $$('#hdMobile a').forEach(function (a) {
      a.addEventListener('click', function () {
        burger.setAttribute('aria-expanded', 'false');
        mob.hidden = true;
      });
    });

    // 패널 열기 (헤더 · 타일)
    $$('[data-open-sheet]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        openSheet(b.getAttribute('data-open-sheet'), b.getAttribute('data-tab'));
      });
    });
    $$('[data-nav-start]').forEach(function (a) {
      a.addEventListener('click', function () { $('#carSearch').focus({ preventScroll: true }); });
    });

    $('#sheetClose').addEventListener('click', function () { closeSheet(); });
    $('#sheetAsk').addEventListener('click', function () {
      if (S.sheet !== 'result') { closeSheet(); document.getElementById('offer').scrollIntoView(); return; }
      var tabs = SHEETS.result.tabs();
      showTab(tabs, 'ask');
      track('ask_click', { car: S.car ? S.car.name : '' });
    });
    $('#sheetRestart').addEventListener('click', function () {
      closeSheet();
      resetDiag();
      document.getElementById('diag').scrollIntoView({ behavior: 'smooth' });
      track('diagnose_restart', {});
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.sheet) closeSheet();
    });

    // 뒤로가기를 누르면 사이트를 떠나는 대신 패널만 닫는다.
    window.addEventListener('popstate', function () {
      if (S.sheet) {
        closeSheet(true);
        track('sheet_close_back', {});
      }
    });

    $$('.gtm-cta').forEach(function (a) {
      a.addEventListener('click', function () {
        track(a.getAttribute('data-gtm-event') || 'cta_click', {
          location: a.getAttribute('data-gtm-location') || '',
          car: S.car ? S.car.name : '', symptoms: S.syms.join(',')
        });
      });
    });
  }

  function fail(err) {
    var local = location.protocol === 'file:';
    var c = $('#diagCard .panel-bd');
    if (c) {
      c.innerHTML = '<h2 class="step-h">자가진단을 불러오지 못했습니다</h2>' +
        (local
          ? '<p class="step-lbl">파일을 직접 열면 브라우저 보안 정책 때문에 데이터를 읽지 못합니다. ' +
            '<code>site/data/data.js</code> 가 있는지 확인하시거나, 서버에 올린 주소로 접속해 주세요.</p>'
          : '<p class="step-lbl">잠시 후 다시 시도해 주세요. 급하시면 전화나 카톡으로 바로 문의하실 수 있습니다.</p>');
    }
    $$('[data-open-sheet]').forEach(function (b) { b.disabled = true; });
    if (window.console) console.error('[대성오토] 데이터 로드 실패', err);
  }

  applyConfig();
  renderGallery();
  bind();
  load().then(function () {
    renderStepBar();
    renderBrands();
    renderCars();
    renderStats();
    syncNav();
  }).catch(fail);

})();
