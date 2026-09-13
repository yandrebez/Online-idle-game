/* =============================================================================
   UI layer: renders Game state, wires input, runs the loop.
   ========================================================================== */
(function (global) {
  'use strict';

  var G = global.Game, D = global.DATA, F = global.Fmt;

  var ICONS = {
    scrapper: '🦾', drone: '🛰', smelter: '🔥', fab: '🖨', line: '🏭',
    replicator: '🧬', fusion: '☀️', quantum: '🌀', dyson: '🪐', core: '🕳'
  };

  var buyMode = 1;
  var els = {};
  var lastFrame = performance.now();
  var dirty = { gens: true, upg: true, shard: true, ach: true };

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    ['matter', 'rate', 'shards', 'shard-counter', 'core-btn', 'core-gain', 'gen-list',
     'upg-list', 'upg-empty', 'upg-dot', 'shard-list', 'ach-list', 'hint',
     'boost-btn', 'boost-sub', 'boost-strip', 'boost-text', 'daily-btn', 'daily-sub',
     'collapse-btn', 'collapse-boost-btn', 'collapse-gain', 'collapse-hint',
     'offline-modal', 'offline-away', 'offline-amount', 'offline-note',
     'offline-double', 'offline-claim', 'menu-modal', 'open-menu', 'menu-close',
     'stat-grid', 'export-btn', 'import-btn', 'save-box', 'reset-btn', 'toggle-num',
     'toasts', 'ad-footer'
    ].forEach(function (id) { els[id] = $(id); });
  }

  /* --------------------------------------------------------------- toasts -- */

  var MAX_TOASTS = 3;

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    els.toasts.appendChild(el);
    // A burst (ten awards at once) must not bury the game behind toasts.
    while (els.toasts.children.length > MAX_TOASTS) {
      els.toasts.removeChild(els.toasts.firstChild);
    }
    setTimeout(function () { el.remove(); }, 3200);
  }

  /* ------------------------------------------------------------ generators -- */

  function buildGenList() {
    els['gen-list'].innerHTML = '';
    D.GENERATORS.forEach(function (gen, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'gen';
      btn.dataset.gen = gen.id;
      btn.innerHTML =
        '<span class="gen-icon">' + (ICONS[gen.id] || '⚙') + '</span>' +
        '<span class="gen-info">' +
          '<span class="gen-name"><span data-name></span><span class="gen-owned" data-owned hidden>0</span></span>' +
          '<span class="gen-desc">' + gen.desc + '</span>' +
          '<span class="gen-rate" data-genrate></span>' +
          '<span class="milestone" data-milestone></span>' +
        '</span>' +
        '<span class="gen-buy">' +
          '<span class="gen-cost" data-cost>0</span>' +
          '<span class="gen-count" data-count></span>' +
        '</span>';
      btn.querySelector('[data-name]').textContent = gen.name;
      btn.addEventListener('click', function () { onBuyGen(gen.id); });
      li.appendChild(btn);
      els['gen-list'].appendChild(li);
      gen._el = btn;
      gen._index = i;
    });
  }

  /** A generator is revealed once the player could plausibly reach it. */
  function genVisible(gen) {
    if ((G.state.gens[gen.id] || 0) > 0) return true;
    if (gen._index === 0) return true;
    var prev = D.GENERATORS[gen._index - 1];
    if ((G.state.gens[prev.id] || 0) > 0) return true;
    return G.state.stats.totalEarned >= gen.cost * 0.35;
  }

  function refreshGens() {
    var matter = G.state.matter;
    D.GENERATORS.forEach(function (gen) {
      var btn = gen._el;
      var li = btn.parentNode;
      var visible = genVisible(gen);
      li.hidden = !visible;
      if (!visible) return;

      var owned = G.state.gens[gen.id] || 0;
      var count = buyMode === 'max' ? Math.max(1, G.genMaxAffordable(gen)) : buyMode;
      var cost = G.genCost(gen, count);
      var afford = cost <= matter && (buyMode !== 'max' ? true : G.genMaxAffordable(gen) > 0);

      var ownedEl = btn.querySelector('[data-owned]');
      ownedEl.hidden = owned === 0;
      ownedEl.textContent = owned;

      btn.querySelector('[data-cost]').textContent = F.n(cost);
      btn.querySelector('[data-cost]').className = 'gen-cost' + (afford ? '' : ' cant');
      btn.querySelector('[data-count]').textContent =
        buyMode === 'max' ? (G.genMaxAffordable(gen) > 0 ? 'buy ' + count : 'max') : 'buy ' + count;

      var each = gen.rate * G.milestoneMultiplier(owned) * G.globalMultiplier();
      var rateEl = btn.querySelector('[data-genrate]');
      rateEl.textContent = owned
        ? F.n(G.genRate(gen) * G.globalMultiplier()) + '/s  ·  ' + F.n(each) + '/s each'
        : F.n(each) + '/s each';

      var next = nextMilestone(owned);
      btn.querySelector('[data-milestone]').textContent =
        next ? '★ ' + (next.at - owned) + ' more → ×' + next.mult + ' output' : '';

      btn.classList.toggle('affordable', afford);
      btn.disabled = !afford;
    });
  }

  function nextMilestone(owned) {
    for (var i = 0; i < D.MILESTONES.length; i++) {
      if (owned < D.MILESTONES[i].at) return D.MILESTONES[i];
    }
    return null;
  }

  function onBuyGen(id) {
    var got = G.buyGenerator(id, buyMode);
    if (!got) return;
    dirty.gens = dirty.upg = true;
    refreshAll();
  }

  /* -------------------------------------------------------------- upgrades -- */

  function refreshUpgrades() {
    var list = els['upg-list'];
    var available = D.UPGRADES.filter(function (u) {
      return !G.hasUpgrade(u.id) && G.upgradeVisible(u);
    });

    els['upg-empty'].hidden = available.length > 0;
    list.innerHTML = '';

    var anyAfford = false;
    available.forEach(function (u) {
      var afford = u.cost <= G.state.matter;
      if (afford) anyAfford = true;

      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'upg' + (afford ? ' affordable' : '');
      btn.disabled = !afford;
      btn.innerHTML =
        '<span><span class="upg-name"></span><span class="upg-desc"></span></span>' +
        '<span class="upg-cost' + (afford ? '' : ' cant') + '"></span>';
      btn.querySelector('.upg-name').textContent = u.name;
      btn.querySelector('.upg-desc').textContent = u.desc;
      btn.querySelector('.upg-cost').textContent = F.n(u.cost);
      btn.addEventListener('click', function () {
        if (G.buyUpgrade(u.id)) {
          toast('Upgrade: ' + u.name);
          refreshAll();
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    els['upg-dot'].hidden = !anyAfford;
  }

  /* ------------------------------------------------------------- prestige -- */

  function refreshPrestige() {
    var gain = G.shardsOnCollapse();
    els['collapse-gain'].textContent = F.n(gain);

    var can = G.canCollapse();
    els['collapse-btn'].disabled = !can;
    els['collapse-btn'].textContent = can ? 'Collapse for ' + F.n(gain) + ' shards' : 'Collapse';
    els['collapse-boost-btn'].hidden = !can;

    els['collapse-hint'].textContent = can
      ? 'Resets matter, generators and upgrades. Shards, awards and daily streak stay.'
      : 'Unlocks at ' + F.n(G.COLLAPSE_THRESHOLD) + ' matter earned this run (' +
        F.n(G.state.stats.totalEarned) + ' so far).';

    var list = els['shard-list'];
    list.innerHTML = '';
    D.SHARD_SHOP.forEach(function (item) {
      var level = G.shardLevel(item.id);
      var maxed = level >= item.max;
      var cost = G.shardUpgradeCost(item);
      var afford = !maxed && cost <= G.state.shards;

      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'shard-item';
      btn.disabled = !afford;
      btn.innerHTML =
        '<span><span class="shard-name"></span><span class="shard-desc"></span></span>' +
        '<span class="shard-cost"></span>';
      var nameEl = btn.querySelector('.shard-name');
      nameEl.textContent = item.name;
      var lvl = document.createElement('span');
      lvl.className = 'shard-lvl';
      lvl.textContent = level + '/' + item.max;
      nameEl.appendChild(lvl);
      btn.querySelector('.shard-desc').textContent = item.desc;
      btn.querySelector('.shard-cost').textContent = maxed ? 'MAX' : cost + ' ◆';
      btn.addEventListener('click', function () {
        if (G.buyShardUpgrade(item.id)) {
          toast(item.name + ' upgraded', 'shard');
          refreshAll();
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function doCollapse(multiplier) {
    var gained = G.collapse(multiplier);
    if (!gained) return;
    toast('Collapsed. +' + F.n(gained) + ' shards', 'shard');
    dirty.gens = dirty.upg = true;
    refreshAll();
    global.Ads.interstitial();
  }

  /* ---------------------------------------------------------- achievements -- */

  function refreshAchievements() {
    var list = els['ach-list'];
    list.innerHTML = '';
    D.ACHIEVEMENTS.forEach(function (a) {
      var got = G.state.achievements.indexOf(a.id) !== -1;
      var li = document.createElement('li');
      li.className = 'ach' + (got ? ' got' : '');
      li.innerHTML = '<span class="ach-mark">' + (got ? '★' : '☆') + '</span>' +
                     '<span><span class="ach-name"></span><span class="ach-desc"></span></span>';
      li.querySelector('.ach-name').textContent = a.name;
      li.querySelector('.ach-desc').textContent = a.desc;
      list.appendChild(li);
    });
  }

  /* ------------------------------------------------------------- counters -- */

  function refreshCounters() {
    els.matter.textContent = F.n(G.state.matter);
    els.rate.textContent = F.n(G.recalc()) + '/s';
    els['shard-counter'].hidden = G.state.shards === 0 && G.state.stats.collapses === 0;
    els.shards.textContent = F.n(G.state.shards);
    els['core-gain'].textContent = '+' + F.n(G.clickPower());
  }

  function refreshBoost() {
    var active = G.boostActive();
    els['boost-strip'].hidden = !active;
    if (active) {
      els['boost-text'].textContent =
        'OVERDRIVE ×' + G.BOOST_MULT + ' — ' + F.time(G.boostRemaining()) + ' left';
    }
    var ready = G.boostReady();
    els['boost-btn'].disabled = !ready;
    els['boost-sub'].textContent = ready
      ? '2 min of triple production'
      : 'Ready in ' + F.time(G.boostCooldownRemaining());
  }

  function refreshDaily() {
    var ready = G.dailyReady();
    els['daily-btn'].disabled = !ready;
    var streak = G.state.dailyStreak;
    els['daily-sub'].textContent = ready
      ? (streak ? 'Streak ' + streak + ' — claim now' : 'Claim your first bonus')
      : 'Next in ' + F.time(G.dailyIn());
  }

  function refreshHint() {
    var s = G.state;
    var msg;
    if (s.stats.clicks < 5) msg = 'Click the core to forge matter.';
    else if (!s.stats.bought) msg = 'Buy a Nano Scrapper — it earns matter while you do nothing.';
    else if (G.recalc() === 0) msg = 'Generators earn matter every second. Buy more.';
    else if (!s.upgrades.length && D.UPGRADES.some(function (u) { return G.upgradeVisible(u); }))
      msg = 'Upgrades are live in the panel on the right — they multiply everything.';
    else if (s.stats.collapses === 0 && s.stats.totalEarned > 1e9)
      msg = 'Collapse unlocks at ' + F.n(G.COLLAPSE_THRESHOLD) + ' matter. Shards are permanent.';
    else if (G.boostReady() && !G.boostActive()) msg = 'Overdrive is ready — ×3 production for two minutes.';
    else msg = 'Your forge keeps running after you close the tab. Come back for offline matter.';
    els.hint.textContent = msg;
  }

  function refreshAll() {
    refreshCounters();
    refreshGens();
    refreshUpgrades();
    refreshPrestige();
    refreshAchievements();
    refreshBoost();
    refreshDaily();
    refreshHint();
  }

  /* ------------------------------------------------------------ click fx -- */

  function floatText(text, x, y) {
    var el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 900);
  }

  function onCoreClick(ev) {
    var gain = G.click();
    var btn = els['core-btn'];
    btn.classList.remove('pop');
    void btn.offsetWidth;              // restart the animation
    btn.classList.add('pop');

    var rect = btn.getBoundingClientRect();
    var x = ev && ev.clientX ? ev.clientX : rect.left + rect.width / 2;
    var y = ev && ev.clientY ? ev.clientY : rect.top + rect.height / 2;
    floatText('+' + F.n(gain), x, y);
  }

  /* --------------------------------------------------------------- modals -- */

  function showOffline() {
    var p = G.pendingOffline;
    if (!p) return;
    els['offline-away'].textContent = 'You were away for ' + F.time(p.seconds) +
      (p.capped ? ' — capped at ' + G.offlineCapHours() + 'h.' : '.');
    els['offline-amount'].textContent = '+' + F.n(p.amount);
    els['offline-note'].textContent = 'Your forge ran at 50% while away. Cold Storage in the shard shop raises the cap.';
    els['offline-modal'].hidden = false;
  }

  function closeOffline() { els['offline-modal'].hidden = true; }

  function refreshStats() {
    var s = G.state.stats;
    var rows = [
      ['Matter per second', F.n(G.recalc())],
      ['Click power', F.n(G.clickPower())],
      ['This run', F.n(s.totalEarned)],
      ['All time', F.n(s.allTimeEarned)],
      ['Clicks', F.n(s.clicks)],
      ['Generators owned', F.n(D.GENERATORS.reduce(function (a, g) { return a + (G.state.gens[g.id] || 0); }, 0))],
      ['Collapses', F.n(s.collapses)],
      ['Shards held', F.n(G.state.shards)],
      ['Awards', G.state.achievements.length + '/' + D.ACHIEVEMENTS.length],
      ['Time played', F.time(s.playTime)],
      ['Offline cap', G.offlineCapHours() + 'h'],
      ['Global multiplier', '×' + F.n(G.globalMultiplier())]
    ];
    els['stat-grid'].innerHTML = rows.map(function (r) {
      return '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
  }

  /* ----------------------------------------------------------------- wire -- */

  function wire() {
    els['core-btn'].addEventListener('click', onCoreClick);

    // Space / Enter on the core should not double-fire with the click handler.
    els['core-btn'].addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
    });
    els['core-btn'].addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') onCoreClick();
    });

    document.querySelectorAll('[data-buy]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-buy]').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var v = chip.dataset.buy;
        buyMode = v === 'max' ? 'max' : parseInt(v, 10);
        refreshGens();
      });
    });

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        $('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    /* --- rewarded: overdrive ------------------------------------------- */
    els['boost-btn'].addEventListener('click', function () {
      if (!G.boostReady()) return;
      els['boost-btn'].disabled = true;
      global.Ads.rewarded('Overdrive ×3 incoming…').then(function (earned) {
        if (earned) {
          G.startBoost();
          toast('Overdrive ×' + G.BOOST_MULT + ' for ' + G.BOOST_SECONDS / 60 + ' minutes', 'gold');
        } else {
          toast('No ad available — try again shortly');
        }
        refreshAll();
      });
    });

    /* --- daily --------------------------------------------------------- */
    els['daily-btn'].addEventListener('click', function () {
      var amount = G.claimDaily();
      if (amount) {
        toast('Daily bonus: +' + F.n(amount) + ' matter', 'gold');
        refreshAll();
      }
    });

    /* --- prestige ------------------------------------------------------ */
    els['collapse-btn'].addEventListener('click', function () {
      if (!G.canCollapse()) return;
      if (!confirm('Collapse the run? You keep shards, awards and your streak — everything else resets.')) return;
      doCollapse(1);
    });

    els['collapse-boost-btn'].addEventListener('click', function () {
      if (!G.canCollapse()) return;
      global.Ads.rewarded('Doubling your shards…').then(function (earned) {
        if (!earned) { toast('No ad available — try again shortly'); return; }
        doCollapse(2);
      });
    });

    /* --- offline ------------------------------------------------------- */
    els['offline-claim'].addEventListener('click', function () {
      var got = G.claimOffline(1);
      closeOffline();
      if (got) toast('Collected +' + F.n(got) + ' matter');
      refreshAll();
    });

    els['offline-double'].addEventListener('click', function () {
      els['offline-double'].disabled = true;
      global.Ads.rewarded('Doubling your offline matter…').then(function (earned) {
        var got = G.claimOffline(earned ? 2 : 1);
        els['offline-double'].disabled = false;
        closeOffline();
        if (got) toast((earned ? 'Doubled! +' : 'Collected +') + F.n(got) + ' matter', earned ? 'gold' : null);
        refreshAll();
      });
    });

    /* --- settings ------------------------------------------------------ */
    els['open-menu'].addEventListener('click', function () {
      refreshStats();
      els['menu-modal'].hidden = false;
    });
    els['menu-close'].addEventListener('click', function () {
      els['menu-modal'].hidden = true;
      els['save-box'].hidden = true;
    });

    els['export-btn'].addEventListener('click', function () {
      var code = G.exportSave();
      els['save-box'].hidden = false;
      els['save-box'].value = code;
      els['save-box'].select();
      try {
        navigator.clipboard.writeText(code).then(function () { toast('Save code copied'); });
      } catch (e) {
        toast('Save code ready — copy it');
      }
    });

    els['import-btn'].addEventListener('click', function () {
      if (els['save-box'].hidden) {
        els['save-box'].hidden = false;
        els['save-box'].value = '';
        els['save-box'].focus();
        toast('Paste a save code, then press Import again');
        return;
      }
      if (G.importSave(els['save-box'].value)) {
        toast('Save imported');
        els['menu-modal'].hidden = true;
        els['save-box'].hidden = true;
        refreshAll();
      } else {
        toast('That code could not be read');
      }
    });

    els['reset-btn'].addEventListener('click', function () {
      if (!confirm('Wipe your save? Shards, awards and every generator are gone for good.')) return;
      if (!confirm('Really wipe it? This cannot be undone.')) return;
      G.hardReset();
      els['menu-modal'].hidden = true;
      refreshAll();
      toast('Save wiped');
    });

    els['toggle-num'].addEventListener('click', function () {
      toast('Short notation is the only format for now');
    });

    /* --- lifecycle ----------------------------------------------------- */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) G.save();
    });
    global.addEventListener('beforeunload', function () { G.save(); });

    G.on(function (evt, payload) {
      if (evt === 'achievements') {
        if (payload.length > 2) {
          toast(payload.length + ' awards unlocked — +' + payload.length + '% production', 'gold');
        } else {
          payload.forEach(function (a) { toast('Award unlocked: ' + a.name, 'gold'); });
        }
      }
    });
  }

  /* ----------------------------------------------------------------- loop -- */

  function loop(now) {
    var dt = Math.min((now - lastFrame) / 1000, 1);   // a hidden tab must not dump matter
    lastFrame = now;

    G.tick(dt);

    // Autoclicker from the shard shop.
    var autoLevel = G.shardLevel('s_auto');
    if (autoLevel > 0) {
      autoAccum += dt * 5 * autoLevel;
      while (autoAccum >= 1) { G.click(); autoAccum -= 1; }
    }

    refreshCounters();
    refreshBoost();
    frameCount++;
    if (frameCount % 12 === 0) {      // ~5 Hz for the expensive lists
      refreshGens();
      refreshUpgrades();
      refreshDaily();
    }
    if (frameCount % 60 === 0) {
      refreshPrestige();
      refreshHint();
      var got = G.checkAchievements();
      if (got.length) refreshAchievements();
    }

    requestAnimationFrame(loop);
  }

  var autoAccum = 0;
  var frameCount = 0;

  /* ----------------------------------------------------------------- boot -- */

  function measureFooter() {
    var h = (global.AD_CONFIG && AD_CONFIG.behaviour && AD_CONFIG.behaviour.footerBanner === false)
      ? 0
      : (els['ad-footer'] ? els['ad-footer'].offsetHeight : 0);
    document.documentElement.style.setProperty('--footer-h', h + 'px');
  }

  function boot() {
    cacheEls();

    var beh = (global.AD_CONFIG && AD_CONFIG.behaviour) || {};
    if (beh.footerBanner === false) els['ad-footer'].remove();
    if (beh.sideRail === false) { var r = $('ad-rail'); if (r) r.remove(); }

    buildGenList();
    G.init();
    wire();
    refreshAll();

    global.Ads.init();
    measureFooter();
    global.addEventListener('resize', measureFooter);
    setTimeout(measureFooter, 1500);   // after an ad iframe settles

    if (G.pendingOffline) showOffline();

    setInterval(function () { G.save(); }, 15000);
    requestAnimationFrame(function (t) { lastFrame = t; requestAnimationFrame(loop); });

    if ('serviceWorker' in navigator) {
      global.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline play is a bonus */ });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
