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

  // 가로로 넘치는 줄(브랜드 칩·시트 탭)에 '더 있다'는 흐림 표시를 켜고 끈다.
  // 휴대폰에는 스크롤바가 없어서 이 표시가 없으면 넘치는 줄인지 알 수 없다.
  function syncScrollHint(scroller, wrap) {
    if (!scroller || !wrap) return;
    var more = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 4;
    wrap.classList.toggle('more', more);
  }

  function watchScrollHint(scroller, wrap) {
    if (!scroller || !wrap) return;
    var run = function () { syncScrollHint(scroller, wrap); };
    scroller.addEventListener('scroll', run, { passive: true });
    window.addEventListener('resize', run);
    run();
  }

  // 데이터를 못 읽었을 때. alert 는 화면을 막아버리고 브라우저 자동화도 멈추므로 쓰지 않는다.
  function showDataNotice() {
    var box = $('#dataNotice');
    if (!box) {
      box = el('div', 'blk');
      box.id = 'dataNotice';
      box.style.cssText = 'border-color:#e2551e;background:#fdf1ec;margin:0 auto 16px;max-width:1100px';
      box.innerHTML = '<p class="blk-h" style="color:#c2440f">가격 자료를 불러오지 못했습니다</p>' +
        '<p class="blk-s">잠시 후 새로고침해 주세요. 급하시면 전화나 카톡으로 바로 안내드립니다.</p>';
      var sec = $('.tiles-sec .wrap');
      if (sec) sec.insertBefore(box, sec.firstChild);
    }
    box.hidden = false;
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
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
    situ: [], syms: [], gear: null, galIdx: 0, revIdx: 0, started: false,
    sheet: null, tab: null, histPushed: false, opener: null
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
      findImage(shop.logo, function (url) {
        var li = $('#logoImg');
        li.src = url;
        li.hidden = false;
      });
    }
    // 배경 사진은 style.css 가 이미 그리고 있다 (첫 화면 속도 때문).
    // 여기서는 설정에 적힌 것과 '다른' 사진을 찾았을 때만 바꿔 끼운다.
    // 같은 사진이면 손대지 않는다 — 손대면 브라우저가 괜히 다시 그린다.
    if (shop.heroImage) {
      findImage(shop.heroImage, function (url) {
        var bg = $('#heroBg');
        var now = '';
        try { now = getComputedStyle(bg).backgroundImage || ''; } catch (e) { }
        var file = url.split('/').pop();
        if (now.indexOf(file) !== -1 || now.indexOf(encodeURIComponent(file)) !== -1) return;
        bg.style.backgroundImage = 'url("' + url + '"), ' +
          'linear-gradient(115deg, #16273f 0%, #1f3557 52%, #2b4670 100%)';
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
    renderReviews();
    renderServices();
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

  /* ---------- 손님 후기 슬라이드 ----------
     캡처마다 세로 길이가 크게 달라 여러 장을 늘어놓으면 지저분하다.
     한 번에 한 장씩 보여주고 화살표·점·손가락으로 넘긴다. */

  var revShown = [];          // 실제로 사진을 찾은 후기만 남긴다

  function renderReviews() {
    var list = CFG.reviews || [];
    var track = $('#revTrack'), sec = $('#reviews');
    if (!track || !sec) return;
    track.innerHTML = '';
    revShown = [];
    var pending = list.length;
    if (!pending) return;

    list.forEach(function (r, i) {
      var item = el('div', 'rev-item');
      var card = el('div', 'rev');
      var img = document.createElement('img');
      img.alt = r.alt || ('대성오토 손님 후기 ' + (i + 1));
      img.decoding = 'async';
      card.appendChild(img);
      item.appendChild(card);
      track.appendChild(item);      // 순서를 지키려고 자리를 먼저 잡아둔다
      item.hidden = true;
      findImage(r.file, function (url) {
        img.onload = function () { revGo(S.revIdx); };   // 사진이 그려진 뒤라야 크기를 잰다
        img.src = url;
        item.hidden = false;
        done();
      }, function () {
        track.removeChild(item);
        done();
      });
    });

    function done() {
      if (--pending) return;
      // 사진 찾기는 비동기라 끝나는 순서가 뒤섞인다. 화면에 놓인 순서대로 다시 모은다.
      revShown = $$('.rev-item', track).filter(function (n) { return !n.hidden; });
      if (!revShown.length) return;
      sec.hidden = false;
      renderRevDots();
      setupRevSwipe();
      revGo(0);
    }
  }

  function renderRevDots() {
    var dots = $('#revDots');
    if (!dots) return;
    dots.innerHTML = '';
    revShown.forEach(function (_, i) {
      var d = el('button');
      d.type = 'button';
      d.className = i === S.revIdx ? 'on' : '';
      d.setAttribute('aria-label', (i + 1) + ' / ' + revShown.length + ' 번째 후기');
      d.addEventListener('click', function () { revGo(i); });
      dots.appendChild(d);
    });
  }

  // 후기마다 길이가 달라서, 보이는 칸의 높이를 그 후기에 맞춘다.
  // 가장 긴 후기에 높이를 맞춰두면 짧은 후기에서 아래가 텅 빈다.
  function revFit() {
    var box = $('#revs'), cur = revShown[S.revIdx];
    if (!box || !cur) return;
    box.style.height = cur.offsetHeight + 'px';
  }

  // 고른 후기를 가운데로 끌어와서, 앞뒤 후기가 양옆에 걸쳐 보이게 한다.
  function revGo(i) {
    if (!revShown.length) return;
    var max = revShown.length - 1;
    S.revIdx = Math.max(0, Math.min(i, max));

    var box = $('#revs'), cur = revShown[S.revIdx];
    var w = cur.offsetWidth || 1;                 // 좌우 여백까지 포함한 한 칸 너비
    var x = box.clientWidth / 2 - (S.revIdx * w + w / 2);
    $('#revTrack').style.transform = 'translateX(' + Math.round(x) + 'px)';

    revShown.forEach(function (n, k) { n.className = 'rev-item' + (k === S.revIdx ? ' on' : ''); });
    $$('#revDots button').forEach(function (d, k) { d.className = k === S.revIdx ? 'on' : ''; });
    $('#revPrev').disabled = S.revIdx <= 0;
    $('#revNext').disabled = S.revIdx >= max;
    revFit();
  }

  function setupRevSwipe() {
    var box = $('#revs');
    if (!box || box.dataset.swipe) return;
    box.dataset.swipe = '1';
    var x0 = null, y0 = null;
    box.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      revGo(S.revIdx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    box.tabIndex = 0;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '손님 후기');
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); revGo(S.revIdx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); revGo(S.revIdx + 1); }
    });
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

  // 고장 범위에 따라 방법이 달라진다는 것을 사다리 모양으로 보여준다.
  // 위에서 아래로 갈수록 손상이 큰 경우이므로 순서가 곧 뜻이다.
  function renderServices() {
    var sv = CFG.services || {};
    var sec = $('#service');
    if (!sv.steps || !sv.steps.length) { if (sec) sec.hidden = true; return; }
    var t = $('[data-service-title]'); if (t) t.textContent = sv.title || '수리 서비스';
    var sb = $('[data-service-sub]'); if (sb) { sb.textContent = sv.sub || ''; sb.hidden = !sv.sub; }
    var g = $('#ladder');
    g.innerHTML = '';
    sv.steps.forEach(function (it, i) {
      g.appendChild(el('li', 'ld',
        '<span class="ld-n">' + (i + 1) + '</span>' +
        '<div class="ld-b">' +
        '<div class="ld-hd"><span class="ld-t">' + esc(it.t) + '</span>' +
        (it.warranty ? '<span class="ld-w">보증 ' + esc(it.warranty) + '</span>' : '') + '</div>' +
        (it.cause ? '<p class="ld-c">' + esc(it.cause) + '</p>' : '') +
        '<p class="ld-d">' + esc(it.d) + '</p>' +
        '</div>'));
    });
    var n = $('[data-service-note]'); if (n) { n.textContent = sv.note || ''; n.hidden = !sv.note; }
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
    // 네이버 지도를 쓸 수 있으면 지도, 아니면 약도 그림.
    if ((CFG.map || {}).naverClientId) setupNaverMap(); else showMapImage();

    if (links.naverPlace) {
      var b = $('#gtm-place');
      b.href = links.naverPlace; b.target = '_blank'; b.rel = 'noopener'; b.hidden = false;
    }
    // 주소도 링크도 없으면 섹션 자체를 감춘다
    if (!addr && !links.naverPlace && !shop.phoneLabel) $('#map').hidden = true;
  }

  /* ---------- 오시는 길 지도 ----------
     네이버 지도는 화면에 들어올 때만 불러온다.
     첫 화면 속도에 영향을 주지 않고, 지도 API 호출수(요금)도 아낀다.
     인증 실패·네트워크 오류 등 어떤 이유로든 못 띄우면 약도 그림으로 되돌아간다. */

  var mapDone = false;   // 지도든 그림이든 한 번만 그린다

  // 지도를 못 쓰게 됐을 때 약도 그림으로 되돌린다.
  // 네이버는 지도를 만든 '뒤에' 인증 실패를 알려주는 경우가 있어서,
  // 로딩 성공 여부와 무관하게 언제든 불릴 수 있어야 한다.
  function mapFallback(why) {
    if (why && window.console) console.warn('[대성오토] ' + why);
    var box = document.getElementById('naverMap');
    if (box && box.parentNode) box.parentNode.removeChild(box);
    mapDone = false;
    showMapImage();
  }

  // 네이버가 인증 실패 시 부르는 전역 함수. 미리 걸어둔다.
  window.navermap_authFailure = function () {
    mapFallback('네이버 지도 인증 실패 — Application 에 등록한 웹 서비스 URL 을 확인하세요');
  };

  // 약도 그림을 넣는다 (지도를 못 쓸 때의 대비책)
  function showMapImage() {
    if (mapDone) return;
    var shop = CFG.shop || {}, links = CFG.links || {};
    if (!shop.mapImage) { mapDone = true; return; }
    var wrap = $('.map-wrap');
    if (!wrap) return;
    findImage(shop.mapImage, function (url) {
      if (mapDone) return;
      mapDone = true;
      var img = new Image();
      img.src = url;
      img.alt = (shop.name || '') + ' 약도';
      var box = el('a', 'map-img gtm-cta cta-place');
      box.href = links.naverPlace || '#';
      if (links.naverPlace) { box.target = '_blank'; box.rel = 'noopener'; }
      box.setAttribute('data-gtm-event', 'naver_place_click');
      box.setAttribute('data-gtm-location', 'map_image');
      box.appendChild(img);
      wrap.insertBefore(box, wrap.firstChild);
      box.addEventListener('click', function () {
        track('naver_place_click', { location: 'map_image' });
      });
    });
  }

  function setupNaverMap() {
    var wrap = $('.map-wrap');
    if (!wrap) return;

    var box = el('div', 'map-live');
    box.id = 'naverMap';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', ((CFG.shop || {}).name || '') + ' 위치 지도');
    wrap.insertBefore(box, wrap.firstChild);

    var started = false;
    function begin() {
      if (started) return;
      started = true;
      loadNaverMaps(drawNaverMap, function (why) { mapFallback(why); });
    }

    // 지도 근처까지 스크롤했을 때 불러온다
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); begin(); }
      }, { rootMargin: '400px' });
      io.observe(box);
    } else {
      begin();
    }
  }

  function loadNaverMaps(onOk, onFail) {
    if (window.naver && window.naver.maps) { onOk(); return; }
    var id = (CFG.map || {}).naverClientId;
    var settled = false;
    function fail(why) { if (!settled) { settled = true; onFail(why); } }

    var sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + encodeURIComponent(id);
    sc.onload = function () {
      if (settled) return;
      if (window.naver && window.naver.maps) { settled = true; onOk(); }
      else fail('네이버 지도 스크립트를 읽었지만 지도 기능이 없습니다');
    };
    sc.onerror = function () { fail('네이버 지도 스크립트를 불러오지 못했습니다'); };
    document.head.appendChild(sc);
    setTimeout(function () { fail('네이버 지도 응답이 없습니다'); }, 8000);
  }

  function drawNaverMap() {
    var m = CFG.map || {}, shop = CFG.shop || {}, links = CFG.links || {};
    var box = $('#naverMap');
    if (!box || !window.naver || !naver.maps) return;
    mapDone = true;
    try {
      var pos = new naver.maps.LatLng(m.lat, m.lng);
      var map = new naver.maps.Map(box, {
        center: pos,
        zoom: m.zoom || 17,
        logoControl: true,
        mapDataControl: false,
        scaleControl: false,
        zoomControl: true,
        zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }
      });
      var marker = new naver.maps.Marker({ position: pos, map: map, title: shop.name || '' });

      // 말풍선을 눌러도, 마커를 눌러도 네이버 플레이스로 간다
      var html = '<div style="padding:9px 12px;font-size:13px;font-weight:700;white-space:nowrap;' +
                 'font-family:inherit;line-height:1.4">' + esc(shop.name || '') +
                 '<div style="font-weight:400;color:#4d5560;font-size:11.5px;margin-top:2px">' +
                 esc(shop.address || '') + '</div></div>';
      var info = new naver.maps.InfoWindow({ content: html, borderColor: '#e4e7ec', disableAnchor: false });
      info.open(map, marker);

      if (links.naverPlace) {
        naver.maps.Event.addListener(marker, 'click', function () {
          track('naver_place_click', { location: 'map_marker' });
          window.open(links.naverPlace, '_blank', 'noopener');
        });
      }
      track('map_view', { kind: 'naver' });
    } catch (e) {
      if (window.console) console.warn('[대성오토] 지도 그리기 실패', e);
      mapFallback(null);
    }
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
    // 칩을 채운 뒤에 재야 넘치는지 알 수 있다 (비어 있을 때 재면 항상 '안 넘침'이 된다)
    syncScrollHint(g, $('#brandWrap'));
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

  // 2단계(언제)는 진단 계산에 쓰이지 않는다. 접수 내용에 참고로 붙을 뿐이다.
  // 그래서 막지 않고 건너뛸 수 있게 둔다. 결과에 영향도 없는 칸을 필수로 만들면
  // 손님을 붙잡아 두고 아무것도 돌려주지 않는 셈이 된다.
  function canNext() {
    if (S.step === 1) return !!S.car;
    if (S.step === 2) return true;
    if (S.step === 3) return S.syms.length > 0;
    return false;
  }

  // 버튼이 회색일 때 무엇을 해야 하는지 알려준다.
  function hintFor() {
    if (S.step === 1 && !S.car) return '먼저 차종을 골라주세요.';
    if (S.step === 3 && !S.syms.length) return '증상을 하나 이상 골라주세요.';
    return '';
  }

  function syncNav() {
    var next = $('#btnNext');
    next.disabled = !canNext();
    next.textContent = S.step === 3 ? '진단 결과 보기'
      : (S.step === 2 && !S.situ.length ? '건너뛰기' : '다음');
    $('#btnPrev').hidden = S.step === 1;
    $('#stepHint').textContent = hintFor();
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
  // 그 차종 실사례가 이만큼 쌓여야 금액 구간을 보여준다.
  // 미달이면 남의 차 평균으로 때우지 않고 '점검 후 안내' 로 넘긴다.
  var MIN_CAR_N = 20;

  function situLabels() {
    return S.situ.map(function (id) {
      var f = ((D.symptoms || {}).situations || []).filter(function (x) { return x.id === id; })[0];
      return f ? f.label : id;
    });
  }

  // 증상의 내부 id 를 손님이 읽는 이름으로 바꾼다.
  // (예: '기어불량' -> '기어 안 들어감', '누유' -> '오일 누유')
  function symLabel(id) {
    var f = ((D.symptoms || {}).symptoms || []).filter(function (x) { return x.id === id; })[0];
    return f ? f.label : id;
  }

  function symLabels() {
    return S.syms.map(symLabel);
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

  // 오직 '그 차종의 실제 청구 내역' 만 쓴다.
  // 예전에는 사례가 모자라면 증상 전체 평균으로 대체했는데, 그 표본이
  // 대부분 국산차라 수입차에 국산 금액이 그대로 찍히는 문제가 있었다.
  function pickBand(type) {
    var byCar = D.cases.byCar[S.car.name];
    if (byCar && byCar[type] && byCar[type].n >= MIN_CAR_N) {
      return { b: byCar[type], src: S.car.name + ' 실사례 ' + byCar[type].n + '건' };
    }
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

  // 같은 차종·사양인데 품번에 따라 금액이 다르면 구간으로 보여준다
  function remanPrice(x) {
    return x.priceMax && x.priceMax !== x.price
      ? won(x.price) + ' ~ ' + won(x.priceMax) + '원'
      : won(x.price) + '원';
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

  // 시트가 열려 있는 동안 뒤쪽 화면은 아예 없는 것으로 취급한다.
  // 이렇게 하지 않으면 탭 키가 보이지 않는 뒤쪽 버튼 91개를 계속 돌아다니고,
  // 읽어주는 프로그램도 뒤쪽 내용을 읽는다.
  var BEHIND = ['.hd', 'main', '.ft', '.rail'];

  function setBehindInert(on) {
    BEHIND.forEach(function (sel) {
      var n = $(sel);
      if (!n) return;
      if (on) { n.setAttribute('inert', ''); n.setAttribute('aria-hidden', 'true'); }
      else { n.removeAttribute('inert'); n.removeAttribute('aria-hidden'); }
    });
  }

  // inert 를 모르는 브라우저용 대비책: 탭이 시트 밖으로 나가면 안으로 되돌린다.
  function trapTab(e) {
    if (e.key !== 'Tab' || !S.sheet) return;
    var sh = $('#sheet');
    var f = $$('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])', sh)
      .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!sh.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openSheet(kind, tabId) {
    var conf = SHEETS[kind];
    if (!conf) return;
    if (!dataReady()) {          // 데이터가 없으면 빈 패널이 뜨는 대신 이유를 알려준다
      showDataNotice();
      return;
    }
    // 같은 패널을 안에서 다시 그리는 경우(차종 고른 뒤)에는 여는 버튼을 덮어쓰면 안 된다.
    // 덮어쓰면 사라질 버튼을 기억하게 되어 닫을 때 초점이 갈 곳을 잃는다.
    if (S.sheet !== kind) S.opener = document.activeElement;
    S.sheet = kind;
    var sh = $('#sheet');
    sh.className = 'sheet' + (conf.narrow ? ' narrow' : '');
    $('#sheetEyebrow').textContent = conf.eyebrow;
    $('#sheetTitle').textContent = typeof conf.title === 'function' ? conf.title() : conf.title;
    $('#sheetRestart').hidden = kind !== 'result';
    $('#sheetAsk').textContent =
      kind === 'result' ? '문의하기' : '상담 문의';

    var tabs = conf.tabs();
    var bar = $('#sheetTabs');
    bar.innerHTML = '';
    S.tab = tabId && tabs.some(function (t) { return t.id === tabId; }) ? tabId : tabs[0].id;
    tabs.forEach(function (t, i) {
      var b = el('button', 'sheet-tab' + (t.id === S.tab ? ' on' : ''));
      b.type = 'button';
      b.id = 'sheetTab-' + t.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'sheetBody');
      b.setAttribute('aria-selected', t.id === S.tab ? 'true' : 'false');
      b.tabIndex = t.id === S.tab ? 0 : -1;   // 탭 묶음은 화살표로 옮기는 것이 표준
      b.textContent = t.label;
      b.addEventListener('click', function () { showTab(tabs, t.id); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
        if (!d) return;
        e.preventDefault();
        var n = tabs[(i + d + tabs.length) % tabs.length];
        showTab(tabs, n.id);
        var nb = $('#sheetTab-' + n.id);
        if (nb) nb.focus();
      });
      bar.appendChild(b);
    });
    bar.parentNode.hidden = tabs.length < 2;

    sh.hidden = false;
    document.body.classList.add('locked');
    setBehindInert(true);
    showTab(tabs, S.tab);
    syncScrollHint($('#sheetTabs'), bar.parentNode);
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
      var on = tabs[i].id === id;
      b.className = 'sheet-tab' + (on ? ' on' : '');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    var t = tabs.filter(function (x) { return x.id === id; })[0];
    $('#sheetBody').setAttribute('aria-label', (t ? t.label : '') + ' 내용');
    restoreLeadForm();          // 폼이 패널 안에 있으면 먼저 빼낸다 (innerHTML 로 지워지면 안 됨)
    var body = $('#sheetBody');
    body.innerHTML = '';
    var pane = el('div', 'sheet-pane');
    body.appendChild(pane);
    if (t) t.render(pane);
    body.scrollTop = 0;
    track('sheet_tab', { sheet: S.sheet, tab: id });
  }

  // fromBack: 뒤로가기로 닫힌 경우. 이때는 history 를 또 되돌리면 안 된다.
  function closeSheet(fromBack) {
    restoreLeadForm();
    $('#sheet').hidden = true;
    document.body.classList.remove('locked');
    setBehindInert(false);
    S.sheet = null;
    // 열기 전에 누른 버튼으로 초점을 돌려놓는다. 그러지 않으면 탭 키가 페이지 맨 위로 튄다.
    try { if (S.opener && S.opener.focus) S.opener.focus({ preventScroll: true }); } catch (e) { }
    S.opener = null;
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
      narrow: true,                  // 읽는 글이라 본문 폭을 좁게 둔다
      title: function () { return S.car ? S.car.name + (S.spec ? ' · ' + S.spec : '') : '진단 결과'; },
      // 탭 순서 주의: '정찰 가격'이 '예상 비용'보다 앞이다.
      // 예상 비용은 그 차종 실사례가 20건 넘게 쌓여야 나오는데 해당 차종이 많지 않다.
      // 정찰 가격은 대부분의 차종에 값이 있으므로, 손님이 먼저 만나야 하는 쪽은 이쪽이다.
      tabs: function () {
        return [
          { id: 'diag', label: '진단', render: paneDiag },
          { id: 'menu', label: '정찰 가격', render: paneMenu },
          { id: 'cost', label: '실제 청구액', render: paneCost },
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
    // 손님이 고른 것을 전부 되돌려 보여준다. 특히 2단계(언제)는 여기 말고 나올 곳이 없다.
    // 물어보고 화면에 안 비치면 헛수고를 시킨 셈이 된다.
    var picked = labels.concat(situLabels());
    if (S.gear && S.gear !== '잘 모르겠음') picked.push(S.gear);
    var emp = el('div', 'blk empathy');
    emp.innerHTML = '<span class="car">' + esc(S.car.name + (S.spec ? ' · ' + S.spec : '')) + '</span>' +
      '<p class="h">' + esc(head) + '</p>' +
      '<p class="p">같은 증상으로 찾아오신 분들이 실제로 어떤 수리를 받았는지 그대로 보여드립니다.</p>' +
      '<div class="tags">' +
      picked.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
    p.appendChild(emp);

    var mix = computeMix();
    var symN = S.syms.reduce(function (a, s) {
      var e = D.cases.bySymptom[s]; return a + (e ? e.n : 0);
    }, 0);
    // 이 비중은 증상 기준 전 차종 집계다. 머리글이 차종명이라 손님은 '내 차 통계'로
    // 읽기 쉬우므로, 무엇을 센 숫자인지 문장에서 분명히 밝힌다.
    var blk = el('div', 'blk');
    blk.innerHTML = '<p class="blk-h">같은 증상으로 실제 진행된 수리</p>' +
      '<p class="blk-s">차종을 가리지 않고 <b>' + esc(labels.join(' · ')) +
      '</b> 증상으로 입고된 ' + won(symN) + '건을 모아 센 것입니다. ' +
      esc(S.car.name) + ' 한 차종만의 통계가 아닙니다.</p>';
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

    // 이 차종 실사례가 모자라면 금액을 지어내지 않는다.
    // 다만 여기서 끝내면 막다른 길이 된다. 정찰 가격은 대부분의 차종에 값이 있으므로
    // 그쪽으로 보내주는 것이 이 화면의 가장 중요한 역할이다.
    var usable = order.filter(function (t) { return pickBand(t); });
    if (!usable.length) {
      var hasMenu = !!(findCategory(S.car.name, S.spec, S.brand) ||
                       (remanFor(S.car.name) || []).length || pricesFor(S.car.name));
      var none = el('div', 'blk');
      none.innerHTML =
        '<p class="blk-h">이 차종은 실제 청구 사례가 아직 모입니다</p>' +
        '<p class="blk-s">같은 증상이라도 사양에 따라 차이가 커서, 사례가 충분히 쌓이기 전에는 ' +
        '금액대를 말씀드리지 않습니다.' +
        (hasMenu ? ' 대신 <b>정해진 정찰 가격</b>은 지금 바로 확인하실 수 있습니다.' : '') + '</p>';
      var col = el('div', 'cta-col');
      if (hasMenu) {
        var go = el('button', 'btn cta ask');
        go.type = 'button';
        go.textContent = '이 차량 정찰 가격 보기';
        go.addEventListener('click', function () {
          showTab(SHEETS.result.tabs(), 'menu');
          track('cost_to_menu', { car: S.car.name });
        });
        col.appendChild(go);
      }
      // 예약 버튼은 아래 고정 바에 이미 있다. 정찰 가격으로 보내는 버튼이 있을 때
      // 초록 예약 버튼을 또 놓으면 같은 화면에 같은 버튼이 두 개가 된다.
      var url = hasMenu ? '' : (((CFG.links || {}).naverReserve) || '');
      if (url) {
        var a = el('a', 'btn cta naver gtm-cta');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = '무상 점검 예약하기';
        a.setAttribute('data-gtm-event', 'naver_reserve_click');
        a.setAttribute('data-gtm-location', 'cost-nodata');
        col.appendChild(a);
      }
      none.appendChild(col);
      p.appendChild(none);
      p.appendChild(el('p', 'disclaimer',
        '차종별로 실제 청구된 내역이 쌓인 경우에만 금액대를 보여드립니다. ' +
        '근거 없는 추정 금액은 안내하지 않습니다.'));
      return;
    }

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

  /* ---------------- 내 차 수리비 찾기 ---------------- */

  // 고른 차를 자가진단 1단계에도 그대로 반영한다.
  // 손님에게 '내 차'는 하나뿐인데 화면 두 곳이 서로 다른 차를 들고 있으면 안 된다.
  function syncHeroPicker() {
    try { renderBrands(); renderCars(); renderSpecs(); syncNav(); } catch (e) { /* 무시 */ }
  }

  // 증상과 상관없이 '그 차종' 사례만 고른다.
  // 결과 화면의 사례 탭은 증상으로도 거르지만, 여기서는 아직 증상을 묻지 않았다.
  function samplesForCar(limit) {
    if (!S.car) return [];
    var out = (D.samples || []).filter(function (x) {
      return norm(x.car) === norm(S.car.name);
    });
    return limit ? out.slice(0, limit) : out;
  }

  function sampleRow(s) {
    return el('div', 'sample',
      '<div><div class="s1">' + esc(s.car) + ' \u00b7 ' +
      esc((s.syms || []).map(symLabel).join(', ')) + '</div>' +
      '<div class="s2">' + (s.ym ? esc(s.ym) + ' \u00b7 ' : '') +
      (s.km ? '약 ' + s.km + '만km \u00b7 ' : '') + esc(LABEL[s.type] || s.type) + '</div></div>' +
      '<div class="r">' + won(s.price) + '원</div>');
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
          '<span class="mn">' + esc(x.mission) + '</span><span class="mp">' + remanPrice(x) + '</span>'));
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

    // 가격만 있으면 광고로 읽힌다. 같은 차를 실제로 얼마에 작업했는지 바로 아래 붙인다.
    // 탭을 따로 두면 눌러보지 않는 손님에게는 없는 것과 같다.
    var recent = samplesForCar(3);
    if (recent.length) {
      var rb = el('div', 'blk recent');
      rb.innerHTML = '<p class="blk-h">' + esc(S.car.name) + ' 최근 실제 작업</p>' +
        '<p class="blk-s">위 정찰 가격과 별개로, 실제로 청구된 내역입니다.</p>';
      recent.forEach(function (x) { rb.appendChild(sampleRow(x)); });
      p.appendChild(rb);
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
    // 아래 폼의 안내문과 어긋나지 않게 쓴다.
    // '연락처만 남겨주세요' 라고 해놓고 다섯 칸을 필수로 받으면 속은 기분이 든다.
    // 수리비 찾기로 들어오면 증상을 묻지 않았다. 채워놓지도 않은 것을
    // '이미 채워져 있습니다' 라고 하면 손님이 빈 칸을 찾느라 헤맨다.
    var asked = S.syms.length > 0;
    blk.innerHTML = '<p class="blk-h">' +
      (asked ? '진단 내용 그대로 문의 남기기' : '이 차량으로 문의 남기기') + '</p>' +
      '<p class="blk-s">' +
      (asked ? '방금 고르신 차종과 증상은 이미 채워져 있습니다. 나머지만 확인해 주세요.'
             : '차종은 이미 채워져 있습니다. 증상만 적어주시면 됩니다.') + '</p>';
    blk.appendChild(form);
    p.appendChild(blk);
    setLeadCtx();
    fillLeadFromDiag();
    var n = $('#leadName');
    if (n && !n.value) setTimeout(function () { n.focus(); }, 120);
  }

  function restoreLeadForm() {
    var form = $('#leadForm'), home = $('#leadHome');
    if (form && home && form.parentNode !== home) home.appendChild(form);
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
    list.forEach(function (x) { blk.appendChild(sampleRow(x)); });
    p.appendChild(blk);
  }

  /* ---------------- 전체 가격표 탭 ---------------- */

  // 미션오일 표는 변속기 형식(아이신 6단 / ZF 6단 …)으로 묶여 있다.
  // 손님은 자기 차의 변속기 형식을 모르므로, 차종으로 찾을 길을 따로 만들어 준다.
  // 걸러내는 단위는 '줄'이 아니라 '형식 묶음'이다. 줄만 남기면
  // '위와 동일 (발보린 규격오일 사용)' 같은 줄이 가리킬 대상을 잃는다.
  function paneAllOil(p) {
    var cats = (D.menu.categories || []).map(function (c) {
      return { c: c, key: norm((c.group || '') + ' ' + (c.name || '') + ' ' + (c.applies || '')) };
    });

    var lab = el('label', 'srch tbl-srch');
    lab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 015.9 13.4l5.4 5.3-1.4 1.4-5.4-5.3A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z" fill="#656d78"/></svg>' +
      '<input type="search" placeholder="차종 검색 (예: 그랜저, 모하비)" autocomplete="off">';
    var holder = el('div');
    p.appendChild(lab);
    p.appendChild(holder);

    function catBox(c) {
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
      return box;
    }

    function draw(q) {
      var nq = norm(q);
      var hits = cats.filter(function (x) { return !nq || x.key.indexOf(nq) !== -1; });
      holder.innerHTML = '';
      if (!hits.length) {
        holder.innerHTML = '<div class="pane-empty">찾으시는 차종이 표에 없습니다.<br>' +
          '전화나 카톡으로 차대번호를 알려주시면 바로 확인해 드립니다.</div>';
        return;
      }
      var groups = {}, order = [];
      hits.forEach(function (x) {
        var g = x.c.group || '기타';
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(x.c);
      });
      order.forEach(function (g) {
        var blk = el('div', 'blk');
        blk.innerHTML = '<p class="blk-h">' + esc(g) + '</p>';
        groups[g].forEach(function (c) { blk.appendChild(catBox(c)); });
        holder.appendChild(blk);
      });
    }

    var timer = null;
    $('input', lab).addEventListener('input', function (e) {
      var v = e.target.value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { draw(v); }, 120);
    });
    draw('');
  }

  // 목록을 임의로 자르면 손님이 '내 차는 안 하는구나' 하고 나가버린다.
  // 성능이 버티는 선까지 올려두고, 실제로 잘릴 때만 안내한다.
  var LIST_LIMIT = 500;

  function searchableList(p, placeholder, entries, rowHtml, emptyHtml) {
    var box = el('div', 'blk');
    var lab = el('label', 'srch tbl-srch');
    lab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 015.9 13.4l5.4 5.3-1.4 1.4-5.4-5.3A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z" fill="#656d78"/></svg>' +
      '<input type="search" placeholder="' + esc(placeholder) + '" autocomplete="off">';
    var holder = el('div');
    box.appendChild(lab);
    box.appendChild(holder);
    p.appendChild(box);

    // 수백 줄을 DOM 에 하나씩 붙이면 느린 휴대폰에서 화면이 몇 초씩 멈춘다.
    // 문자열로 한 번에 조립해서 innerHTML 로 넣는다.
    function draw(q) {
      var nq = norm(q);
      var hits = entries.filter(function (e) { return !nq || norm(e.key).indexOf(nq) !== -1; });
      if (!hits.length) {
        holder.innerHTML = '<div class="pane-empty">' + (emptyHtml || '검색 결과가 없습니다.') + '</div>';
        return;
      }
      var shown = hits.slice(0, LIST_LIMIT), html = '', i;
      for (i = 0; i < shown.length; i++) html += rowHtml(shown[i]);
      if (hits.length > LIST_LIMIT) {
        html += '<p class="mnote">목록이 많아 ' + LIST_LIMIT +
                '건까지만 표시했습니다. 차종을 검색해 주세요. (전체 ' + won(hits.length) + '건)</p>';
      }
      holder.innerHTML = html;
    }

    // 한 글자마다 전체를 다시 그리면 입력이 밀린다.
    var timer = null;
    $('input', lab).addEventListener('input', function (e) {
      var v = e.target.value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { draw(v); }, 120);
    });
    draw('');
  }

  function paneAllReman(p) {
    var entries = Object.keys(D.reman).map(function (car) { return { key: car, car: car }; })
      .sort(function (a, b) { return a.car.localeCompare(b.car, 'ko'); });
    searchableList(p, '차종 검색 (예: 그랜저, 모하비)', entries, function (e) {
      var h = '<div class="mcat"><div class="mcat-n">' + esc(e.car) + '</div>';
      D.reman[e.car].forEach(function (x) {
        h += '<div class="mrow"><span class="mn">' + esc(x.mission) +
             '</span><span class="mp">' + remanPrice(x) + '</span></div>';
      });
      return h + '</div>';
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
    searchableList(p, '차종 검색 (예: 그랜저 HG)', entries, function (e) {
      var h = '<div class="mcat"><div class="mcat-n">' + esc(e.car) +
        (e.spec && e.spec !== '-' ? ' <span class="mcat-a" style="display:inline">' + esc(e.spec) + '</span>' : '') +
        '</div>';
      ITEMS.forEach(function (pair) {
        if (!e.v[pair[0]]) return;
        h += '<div class="mrow"><span class="mn">' + esc(pair[1]) +
             '</span><span class="mp">' + won(e.v[pair[0]]) + '원</span></div>';
      });
      return h + '</div>';
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
    setLeadCtx();
    fillLeadFromDiag();
    var mix = computeMix();
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
    var tr = $('#galTrack');
    tr.innerHTML = '';
    items.forEach(function (g, i) {
      var it = el('div', 'gal-item');
      it.innerHTML = '<div class="gal-ph"><span class="num">' + esc(g.step) + '</span>' +
        '<img alt="' + esc(g.title) + '" loading="lazy" decoding="async">' +
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
    });
    renderGalDots();
    setupGalSwipe();
    galGo(0);       // 처음부터 '이전' 화살표를 흐리게 해 둔다
  }

  function galPer() {
    var w = window.innerWidth;
    return w >= 1000 ? 3 : (w >= 768 ? 2 : 1);
  }

  // 한 번에 몇 장 보이는지에 따라 '넘길 수 있는 칸' 수가 달라진다.
  // 사진 수만큼 점을 찍으면 데스크톱(3장씩)에서는 뒤쪽 점이 눌러도 안 움직인다.
  function galPages() {
    var n = (CFG.gallery || []).length;
    return Math.max(1, n - galPer() + 1);
  }

  function renderGalDots() {
    var dots = $('#galDots'), pages = galPages();
    dots.innerHTML = '';
    for (var i = 0; i < pages; i++) {
      (function (i) {
        var d = el('button');
        d.type = 'button';
        d.className = i === S.galIdx ? 'on' : '';
        d.setAttribute('aria-label', (i + 1) + ' / ' + pages + ' 번째로 이동');
        d.addEventListener('click', function () { galGo(i); });
        dots.appendChild(d);
      })(i);
    }
  }

  function galGo(i) {
    var items = CFG.gallery || [];
    if (!items.length) return;
    var per = galPer();
    var max = galPages() - 1;
    S.galIdx = Math.max(0, Math.min(i, max));
    $('#galTrack').style.transform = 'translateX(' + (-S.galIdx * (100 / per)) + '%)';
    $$('#galDots button').forEach(function (d, k) { d.className = k === S.galIdx ? 'on' : ''; });
    // 끝에 닿으면 화살표를 흐리게 해서 더 없다는 것을 알린다
    $('#galPrev').disabled = S.galIdx <= 0;
    $('#galNext').disabled = S.galIdx >= max;
  }

  // 손가락으로 밀어서 넘기기. 휴대폰에서 34px 화살표만 누르게 하는 것은 무리다.
  function setupGalSwipe() {
    var gal = $('.gal');
    if (!gal || gal.dataset.swipe) return;
    gal.dataset.swipe = '1';
    var x0 = null, y0 = null;
    gal.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    gal.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      // 세로로 더 많이 움직였으면 페이지를 스크롤하려던 것이므로 건드리지 않는다
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      galGo(S.galIdx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // 키보드로도 넘어가야 한다
    gal.tabIndex = 0;
    gal.setAttribute('role', 'group');
    gal.setAttribute('aria-label', '작업 과정 사진');
    gal.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); galGo(S.galIdx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); galGo(S.galIdx + 1); }
    });
  }

  /* ------------------------------------------------------------- 폼 전송 */

  // 국번 길이가 번호마다 다르므로 무조건 3-4-4 로 자르면 안 된다.
  //   02        : 서울           (02-1234-5678)
  //   050X      : 안심번호       (0507-1234-5678)
  //   15/16/18XX: 대표번호       (1588-1234)
  //   그 외     : 3자리 국번     (031-921-8801 / 010-1234-5678)
  function fmtPhone(v) {
    var d = v.replace(/[^0-9]/g, '').slice(0, 12);
    if (!d) return '';

    // 뒤 4자리를 떼어내고 나머지를 국번으로 둔다.
    function cut(head) {
      var a = d.slice(0, head), rest = d.slice(head);
      if (!rest) return a;
      if (rest.length < 7) return a + '-' + rest;      // 입력 중에는 덜 쪼갠다
      return a + '-' + rest.slice(0, rest.length - 4) + '-' + rest.slice(rest.length - 4);
    }

    if (/^1[5678]/.test(d)) {                          // 대표번호 (8자리)
      return d.length <= 4 ? d : d.slice(0, 4) + '-' + d.slice(4, 8);
    }
    if (d.indexOf('02') === 0) return cut(2);          // 서울
    if (/^050\d/.test(d)) return cut(4);               // 안심번호
    return cut(3);                                     // 010 · 031 · 070 등
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
  // 보낼 내용을 손님에게 미리 보여주는 줄.
  // 증상을 묻지 않은 경로(수리비 찾기)에서는 차종만 적는다.
  function setLeadCtx() {
    var box = $('#leadCtx');
    if (!box) return;
    if (!S.car) { box.textContent = ''; return; }
    var t = '보내실 내용: ' + S.car.name + (S.spec ? ' ' + S.spec : '');
    if (S.syms.length) t += ' / ' + symLabels().join(', ');
    if (S.gear && S.gear !== '잘 모르겠음') t += ' / ' + S.gear;
    box.textContent = t;
  }

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
    var agree = $('#leadAgree');

    // 칸마다 무엇이 잘못됐는지 그 칸 아래에 적는다.
    // '모두 입력해 주세요' 한 줄만 띄우면 어디가 문제인지 손님이 찾아야 한다.
    var checks = [
      { el: f.nameEl,    err: 'errName',    ok: !!f.name,               why: '성함을 적어주세요.' },
      { el: f.phoneEl,   err: 'errPhone',   ok: f.digits.length >= 9,   why: '연락처를 정확히 적어주세요.' },
      { el: f.plateEl,   err: 'errPlate',   ok: !!f.plate,              why: '차량번호를 적어주세요. 모르시면 차종만이라도 알려주세요.' },
      { el: f.carEl,     err: 'errCar',     ok: !!f.car,                why: '차종을 적어주세요.' },
      { el: f.symptomEl, err: 'errSymptom', ok: !!f.symptom,            why: '어떤 증상인지 적어주세요.' }
    ];
    if (agree) {
      checks.push({ el: agree, err: 'errAgree', ok: agree.checked,
                    why: '개인정보 이용에 동의해 주셔야 접수할 수 있습니다.' });
    }
    var bad = null;
    checks.forEach(function (c) {
      c.el.setAttribute('aria-invalid', c.ok ? 'false' : 'true');
      var box = $('#' + c.err);
      if (box) box.textContent = c.ok ? '' : c.why;
      if (!c.ok && !bad) bad = c.el;
    });
    if (bad) {
      msg.className = 'lead-msg err';
      msg.textContent = '표시된 칸을 확인해 주세요.';
      try { bad.focus({ preventScroll: false }); } catch (err) { }
      return;
    }
    msg.textContent = '';

    var lead = CFG.lead || {};
    var mode = lead.mode || 'auto';
    if (mode === 'auto') mode = isMobile() ? 'sms' : 'kakao';
    var text = leadMessage(f);
    var dial = ((CFG.shop || {}).phoneDial || '').replace(/[^0-9+]/g, '');

    track('lead_submit', { brand: S.brand, car: f.car, symptoms: f.symptom, method: mode });

    // 시트 주소가 있으면 그걸로 접수한다. (엑셀로 내려받을 수 있는 유일한 경로)
    // 전송이 실패하면 성공한 척하지 않고 문자·카톡으로 넘겨서 접수를 잃지 않게 한다.
    if (lead.sheetUrl) {
      var btn = $('#gtm-lead-submit');
      var btnTxt = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '보내는 중...'; }
      msg.className = 'lead-msg wait';
      msg.textContent = '접수 중입니다. 잠시만 기다려 주세요...';

      sendToSheet(lead.sheetUrl, f).then(function () {
        ok(msg, '접수되었습니다. 확인 후 곧 연락드리겠습니다.');
        markSubmitted();
      }, function (err) {
        if (btn) { btn.disabled = false; btn.textContent = btnTxt || '상담 요청 보내기'; }
        if (window.console) console.warn('[대성오토] 시트 접수 실패, 문자·카톡으로 전환합니다', err);
        track('lead_sheet_fail', {});
        handoff(msg, text, dial, mode, true);
      });
      return;
    }
    if (mode === 'sheet') {          // 시트를 쓰겠다고 해놓고 주소가 없는 경우
      msg.className = 'lead-msg err';
      msg.textContent = '접수 설정이 아직 되어 있지 않습니다. 전화로 문의해 주세요.';
      return;
    }
    handoff(msg, text, dial, mode, false);
  }

  // 상담 내용을 구글 시트로 보낸다. 네트워크가 실패하거나 응답이 없으면 reject 한다.
  // no-cors 라 서버가 돌려준 내용은 읽을 수 없지만, 전송 자체의 실패는 여기서 잡힌다.
  function sendToSheet(url, f) {
    if (!window.fetch) return Promise.reject(new Error('이 브라우저는 fetch 를 지원하지 않습니다'));
    var opts = {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name: f.name, phone: f.phone, plate: f.plate, car: f.car, symptom: f.symptom,
        brand: S.brand || '', pickedCar: S.car ? S.car.name : '', spec: S.spec || '',
        situations: situLabels().join(', '), symptoms: symLabels().join(', '),
        gear: S.gear || '',
        page: location.href, ref: document.referrer, ts: new Date().toISOString()
      })
    };
    var ctl = null, timer = null;
    try { ctl = new AbortController(); opts.signal = ctl.signal; } catch (e) { /* 구형 브라우저 */ }
    var p = fetch(url, opts);
    if (ctl) timer = setTimeout(function () { try { ctl.abort(); } catch (e) { } }, 12000);
    return p.then(
      function (r) { if (timer) clearTimeout(timer); return r; },
      function (e) { if (timer) clearTimeout(timer); throw e; }
    );
  }

  // 문자 · 카카오톡 · 전화 순으로 접수를 넘긴다.
  // fallback=true 는 시트 접수가 실패해서 대신 넘어온 경우다.
  function handoff(msg, text, dial, mode, fallback) {
    var m = (mode === 'sms' || mode === 'kakao') ? mode : (isMobile() ? 'sms' : 'kakao');
    if (m === 'sms' && dial) {
      var sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
      location.href = 'sms:' + dial + sep + 'body=' + encodeURIComponent(text);
      ok(msg, fallback
        ? '연결이 불안정해 문자로 보내드립니다. 전송 버튼만 눌러주세요.'
        : '문자 앱이 열립니다. 전송 버튼만 눌러주세요.');
      return;
    }
    var kakao = (CFG.links || {}).kakaoChat;
    if (kakao) {
      copy(text);
      window.open(kakao, '_blank', 'noopener');
      ok(msg, fallback
        ? '연결이 불안정해 카카오톡으로 연결했습니다. 내용이 복사되어 있으니 붙여넣기만 하시면 됩니다.'
        : '카카오톡 상담창이 열렸습니다. 내용이 복사되어 있으니 붙여넣기만 하시면 됩니다.');
      return;
    }
    if (dial) { location.href = 'tel:' + dial; return; }
    msg.className = 'lead-msg err';
    msg.textContent = fallback
      ? '접수에 실패했습니다. 죄송하지만 ' + (((CFG.shop || {}).phoneLabel) || '전화') + ' 로 연락 주세요.'
      : '상담 연결 설정이 아직 되어 있지 않습니다. 전화로 문의해 주세요.';
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
    // 화면 폭이 바뀌면 한 번에 보이는 장수가 달라지므로 점도 다시 찍는다
    window.addEventListener('resize', function () {
      renderGalDots();
      galGo(S.galIdx);
      revGo(S.revIdx);          // 폭이 바뀌면 가운데 위치와 높이를 다시 잡는다
    });

    $('#revPrev').addEventListener('click', function () { revGo(S.revIdx - 1); });
    $('#revNext').addEventListener('click', function () { revGo(S.revIdx + 1); });

    // 가로로 넘치는 줄에 흐림 표시
    watchScrollHint($('#brandGrid'), $('#brandWrap'));
    watchScrollHint($('#sheetTabs'), $('.sheet-tabs-wrap'));

    $('#leadForm').addEventListener('submit', submitLead);
    $('#leadPhone').addEventListener('input', function (e) { e.target.value = fmtPhone(e.target.value); });
    var FIELDS = [['#leadName', 'errName'], ['#leadPhone', 'errPhone'], ['#leadPlate', 'errPlate'],
                  ['#leadCar', 'errCar'], ['#leadSymptom', 'errSymptom']];
    FIELDS.forEach(function (pair) {
      var el2 = $(pair[0]);
      if (!el2) return;
      el2.addEventListener('input', function () {
        el2.dataset.typed = '1';
        if (el2.value.trim()) {
          el2.setAttribute('aria-invalid', 'false');
          var box = $('#' + pair[1]);
          if (box) box.textContent = '';     // 고치는 순간 빨간 글씨를 지운다
        }
      });
    });
    var agree = $('#leadAgree');
    if (agree) {
      agree.addEventListener('change', function () {
        if (agree.checked) {
          agree.setAttribute('aria-invalid', 'false');
          $('#errAgree').textContent = '';
        }
      });
    }

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
      // 수리비 찾기에서 차를 고른 뒤라면 문의 탭이 있다. 그쪽으로 보낸다.
      var kind = S.sheet === 'result' ? S.sheet : null;
      if (!kind) { closeSheet(); document.getElementById('offer').scrollIntoView(); return; }
      showTab(SHEETS[kind].tabs(), 'ask');
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
      trapTab(e);       // 탭 키가 시트 밖으로 새어나가지 않게
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
