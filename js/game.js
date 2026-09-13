/* =============================================================================
   Game engine: state, economy, save/load, offline progress, prestige.
   No DOM work happens in here — ui.js reads this and draws.
   ========================================================================== */
(function (global) {
  'use strict';

  var D = global.DATA;
  var SAVE_KEY = 'nanoforge.save.v1';
  var BASE_OFFLINE_CAP_H = 8;
  var OFFLINE_EFFICIENCY = 0.5;     // idle-away rate vs. active rate
  var BOOST_SECONDS = 120;
  var BOOST_MULT = 3;
  var BOOST_COOLDOWN_SEC = 300;
  var DAILY_COOLDOWN_H = 20;        // generous: a "day" you can hit any evening

  function freshState() {
    return {
      version: 1,
      matter: 0,
      shards: 0,
      gens: {},                 // id -> count
      upgrades: [],             // purchased upgrade ids
      shardUpgrades: {},        // id -> level
      achievements: [],
      boostUntil: 0,
      boostReadyAt: 0,
      lastSeen: Date.now(),
      lastDaily: 0,
      dailyStreak: 0,
      runStart: Date.now(),
      stats: {
        clicks: 0,
        bought: 0,
        totalEarned: 0,        // this run
        allTimeEarned: 0,
        collapses: 0,
        boosts: 0,
        offlineClaims: 0,
        dailyClaims: 0,
        playTime: 0
      }
    };
  }

  var Game = {
    state: freshState(),
    pendingOffline: null,      // { seconds, amount } awaiting a claim
    listeners: [],

    /* -------------------------------------------------------------- setup -- */

    init: function () {
      var loaded = this.load();
      if (loaded) this._applyOffline();
      this.recalc();
      return loaded;
    },

    on: function (fn) { this.listeners.push(fn); },
    emit: function (evt, payload) {
      this.listeners.forEach(function (fn) { fn(evt, payload); });
    },

    /* ------------------------------------------------------------ economy -- */

    shardLevel: function (id) {
      return this.state.shardUpgrades[id] || 0;
    },

    hasUpgrade: function (id) {
      return this.state.upgrades.indexOf(id) !== -1;
    },

    /** Multiplier applied to every generator. */
    globalMultiplier: function () {
      var s = this.state;
      var m = 1;

      D.UPGRADES.forEach(function (u) {
        if (u.kind === 'global' && s.upgrades.indexOf(u.id) !== -1) m *= u.mult;
      });

      // Prestige: each shard held is a permanent +2%.
      m *= 1 + s.shards * 0.02;

      // Shard shop: Dense Reality.
      m *= Math.pow(1.5, this.shardLevel('s_prod'));

      // Achievements: +1% each.
      m *= 1 + s.achievements.length * 0.01;

      // Overdrive.
      if (s.boostUntil > Date.now()) m *= BOOST_MULT;

      // Daily streak: +5% per consecutive day, capped at +50%.
      m *= 1 + Math.min(s.dailyStreak, 10) * 0.05;

      return m;
    },

    /** Milestone multiplier for one generator, from how many are owned. */
    milestoneMultiplier: function (owned) {
      var m = 1;
      D.MILESTONES.forEach(function (ms) { if (owned >= ms.at) m *= ms.mult; });
      return m;
    },

    /** Matter per second produced by one generator line. */
    genRate: function (gen) {
      var owned = this.state.gens[gen.id] || 0;
      if (!owned) return 0;
      var m = this.milestoneMultiplier(owned);
      var s = this.state;
      D.UPGRADES.forEach(function (u) {
        if (u.kind === 'gen' && u.gen === gen.id && s.upgrades.indexOf(u.id) !== -1) m *= u.mult;
      });
      return owned * gen.rate * m;
    },

    /** Total matter per second. */
    rate: function () {
      var self = this;
      var base = D.GENERATORS.reduce(function (a, g) { return a + self.genRate(g); }, 0);
      return base * this.globalMultiplier();
    },

    /** Matter granted by one click. */
    clickPower: function () {
      var s = this.state;
      var power = 1;

      D.UPGRADES.forEach(function (u) {
        if (u.kind === 'click' && s.upgrades.indexOf(u.id) !== -1) power *= u.mult;
      });
      power *= Math.pow(3, this.shardLevel('s_click'));
      power *= this.globalMultiplier();

      // Late game, clicking only stays relevant if it scales with production.
      var pct = 0;
      D.UPGRADES.forEach(function (u) {
        if (u.kind === 'clickFromRate' && s.upgrades.indexOf(u.id) !== -1) pct += u.pct;
      });
      power += this.rate() * pct;

      return power;
    },

    offlineCapHours: function () {
      return BASE_OFFLINE_CAP_H + this.shardLevel('s_offline') * 4;
    },

    /* -------------------------------------------------------------- costs -- */

    genCost: function (gen, count) {
      var owned = this.state.gens[gen.id] || 0;
      return global.Fmt.bulkCost(gen.cost, D.COST_GROWTH, owned, count || 1);
    },

    genMaxAffordable: function (gen) {
      var owned = this.state.gens[gen.id] || 0;
      return global.Fmt.maxAffordable(gen.cost, D.COST_GROWTH, owned, this.state.matter);
    },

    /* ------------------------------------------------------------ actions -- */

    click: function () {
      var gain = this.clickPower();
      this._earn(gain);
      this.state.stats.clicks++;
      this.checkAchievements();
      return gain;
    },

    buyGenerator: function (id, count) {
      var gen = D.GENERATORS.filter(function (g) { return g.id === id; })[0];
      if (!gen) return 0;

      var want = count === 'max' ? this.genMaxAffordable(gen) : (count || 1);
      if (want <= 0) return 0;

      var cost = this.genCost(gen, want);
      if (cost > this.state.matter) return 0;

      this.state.matter -= cost;
      this.state.gens[id] = (this.state.gens[id] || 0) + want;
      this.state.stats.bought += want;
      this.checkAchievements();
      this.emit('buy', { id: id, count: want });
      return want;
    },

    buyUpgrade: function (id) {
      if (this.hasUpgrade(id)) return false;
      var u = D.UPGRADES.filter(function (x) { return x.id === id; })[0];
      if (!u || !this.upgradeVisible(u) || u.cost > this.state.matter) return false;

      this.state.matter -= u.cost;
      this.state.upgrades.push(id);
      this.checkAchievements();
      this.emit('upgrade', u);
      return true;
    },

    /** Upgrades stay hidden until their requirement is met — keeps the list short. */
    upgradeVisible: function (u) {
      var s = this.state;
      var r = u.req || {};
      if (r.clicks && s.stats.clicks < r.clicks) return false;
      if (r.total && s.stats.totalEarned < r.total) return false;
      if (r.owned) {
        for (var id in r.owned) {
          if ((s.gens[id] || 0) < r.owned[id]) return false;
        }
      }
      return true;
    },

    buyShardUpgrade: function (id) {
      var item = D.SHARD_SHOP.filter(function (x) { return x.id === id; })[0];
      if (!item) return false;
      var level = this.shardLevel(id);
      if (level >= item.max) return false;

      var cost = Math.ceil(item.cost * Math.pow(2, level));
      if (cost > this.state.shards) return false;

      this.state.shards -= cost;
      this.state.shardUpgrades[id] = level + 1;
      this.emit('shardUpgrade', item);
      return true;
    },

    shardUpgradeCost: function (item) {
      return Math.ceil(item.cost * Math.pow(2, this.shardLevel(item.id)));
    },

    /* ----------------------------------------------------------- prestige -- */

    COLLAPSE_THRESHOLD: 1e12,

    shardsOnCollapse: function () {
      var earned = this.state.stats.totalEarned;
      if (earned < this.COLLAPSE_THRESHOLD) return 0;
      var base = Math.floor(Math.pow(earned / 1e10, 0.5));
      var bonus = 1 + this.shardLevel('s_shard') * 0.25;
      return Math.max(1, Math.floor(base * bonus));
    },

    canCollapse: function () {
      return this.state.stats.totalEarned >= this.COLLAPSE_THRESHOLD;
    },

    collapse: function (bonusMultiplier) {
      if (!this.canCollapse()) return 0;
      var gained = Math.floor(this.shardsOnCollapse() * (bonusMultiplier || 1));

      var keep = {
        shards: this.state.shards + gained,
        shardUpgrades: this.state.shardUpgrades,
        achievements: this.state.achievements,
        lastDaily: this.state.lastDaily,
        dailyStreak: this.state.dailyStreak,
        stats: this.state.stats
      };

      this.state = freshState();
      this.state.shards = keep.shards;
      this.state.shardUpgrades = keep.shardUpgrades;
      this.state.achievements = keep.achievements;
      this.state.lastDaily = keep.lastDaily;
      this.state.dailyStreak = keep.dailyStreak;
      this.state.stats = keep.stats;
      this.state.stats.totalEarned = 0;      // per-run counter resets
      this.state.stats.collapses++;

      this._applyHeadStart();
      this.checkAchievements();
      this.save();
      this.emit('collapse', { shards: gained });
      return gained;
    },

    _applyHeadStart: function () {
      var tiers = this.shardLevel('s_head');
      for (var i = 0; i < tiers && i < D.GENERATORS.length; i++) {
        this.state.gens[D.GENERATORS[i].id] = 5;
      }
    },

    /* -------------------------------------------------------------- boost -- */

    boostActive: function () { return this.state.boostUntil > Date.now(); },
    boostReady: function () { return Date.now() >= this.state.boostReadyAt; },
    boostRemaining: function () { return Math.max(0, (this.state.boostUntil - Date.now()) / 1000); },
    boostCooldownRemaining: function () { return Math.max(0, (this.state.boostReadyAt - Date.now()) / 1000); },

    startBoost: function () {
      var now = Date.now();
      this.state.boostUntil = Math.max(now, this.state.boostUntil) + BOOST_SECONDS * 1000;
      this.state.boostReadyAt = now + (BOOST_SECONDS + BOOST_COOLDOWN_SEC) * 1000;
      this.state.stats.boosts++;
      this.checkAchievements();
      this.emit('boost', { seconds: BOOST_SECONDS, mult: BOOST_MULT });
    },

    BOOST_MULT: BOOST_MULT,
    BOOST_SECONDS: BOOST_SECONDS,

    /* -------------------------------------------------------------- daily -- */

    dailyReady: function () {
      return Date.now() - this.state.lastDaily >= DAILY_COOLDOWN_H * 3600e3;
    },

    dailyIn: function () {
      return Math.max(0, (this.state.lastDaily + DAILY_COOLDOWN_H * 3600e3 - Date.now()) / 1000);
    },

    /** Daily bonus = a chunk of production, scaled by streak. */
    dailyReward: function () {
      var perSec = this.rate();
      var streak = Math.min(this.state.dailyStreak + 1, 7);
      // 10 minutes of production per streak day, with a floor for new players.
      return Math.max(50, perSec * 600 * streak);
    },

    claimDaily: function () {
      if (!this.dailyReady()) return 0;
      var amount = this.dailyReward();
      // Streak breaks if they were gone more than 48h.
      var gap = Date.now() - this.state.lastDaily;
      this.state.dailyStreak = gap > 48 * 3600e3 ? 1 : this.state.dailyStreak + 1;
      this.state.lastDaily = Date.now();
      this.state.stats.dailyClaims++;
      this._earn(amount);
      this.checkAchievements();
      this.save();
      this.emit('daily', { amount: amount, streak: this.state.dailyStreak });
      return amount;
    },

    /* ------------------------------------------------------------ offline -- */

    _applyOffline: function () {
      var away = (Date.now() - (this.state.lastSeen || Date.now())) / 1000;
      if (away < 60) return;                       // not worth a popup

      var cap = this.offlineCapHours() * 3600;
      var counted = Math.min(away, cap);
      var amount = this.rate() * counted * OFFLINE_EFFICIENCY;
      if (amount <= 0) return;

      this.pendingOffline = {
        seconds: away,
        counted: counted,
        capped: away > cap,
        amount: amount
      };
    },

    claimOffline: function (multiplier) {
      if (!this.pendingOffline) return 0;
      var amount = this.pendingOffline.amount * (multiplier || 1);
      this._earn(amount);
      this.state.stats.offlineClaims++;
      this.pendingOffline = null;
      this.checkAchievements();
      this.save();
      return amount;
    },

    /* ------------------------------------------------------- achievements -- */

    checkAchievements: function () {
      var s = this.state;
      var rate = this._cachedRate || 0;
      var unlocked = [];
      var self = this;
      D.ACHIEVEMENTS.forEach(function (a) {
        if (s.achievements.indexOf(a.id) !== -1) return;
        var ok = false;
        try { ok = a.test(s, rate); } catch (e) { ok = false; }
        if (ok) { s.achievements.push(a.id); unlocked.push(a); }
      });
      if (unlocked.length) self.emit('achievements', unlocked);
      return unlocked;
    },

    /* --------------------------------------------------------------- tick -- */

    _earn: function (amount) {
      this.state.matter += amount;
      this.state.stats.totalEarned += amount;
      this.state.stats.allTimeEarned += amount;
    },

    recalc: function () {
      this._cachedRate = this.rate();
      return this._cachedRate;
    },

    /** Advance the simulation by dt seconds. */
    tick: function (dt) {
      var rate = this.recalc();
      if (rate > 0) this._earn(rate * dt);
      this.state.stats.playTime += dt;
      this.state.lastSeen = Date.now();
    },

    /* --------------------------------------------------------------- save -- */

    save: function () {
      this.state.lastSeen = Date.now();
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
        return true;
      } catch (e) {
        return false;                      // private mode / quota — play on
      }
    },

    load: function () {
      var raw;
      try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
      if (!raw) return false;
      try {
        var data = JSON.parse(raw);
        this.state = this._migrate(data);
        return true;
      } catch (e) {
        return false;                      // corrupt save: start clean
      }
    },

    /** Fill in anything a save from an older version is missing. */
    _migrate: function (data) {
      var base = freshState();
      var out = Object.assign(base, data);
      out.stats = Object.assign(base.stats, data.stats || {});
      out.gens = data.gens || {};
      out.upgrades = Array.isArray(data.upgrades) ? data.upgrades : [];
      out.achievements = Array.isArray(data.achievements) ? data.achievements : [];
      out.shardUpgrades = data.shardUpgrades || {};
      // Numbers that arrive as strings or NaN from a hand-edited save.
      ['matter', 'shards', 'boostUntil', 'boostReadyAt', 'lastSeen', 'lastDaily', 'dailyStreak'].forEach(function (k) {
        var v = Number(out[k]);
        out[k] = isFinite(v) ? v : base[k];
      });
      return out;
    },

    exportSave: function () {
      return btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));
    },

    importSave: function (text) {
      try {
        var json = decodeURIComponent(escape(atob(String(text).trim())));
        var data = JSON.parse(json);
        if (typeof data !== 'object' || data === null) return false;
        this.state = this._migrate(data);
        this.recalc();
        this.save();
        return true;
      } catch (e) {
        return false;
      }
    },

    hardReset: function () {
      this.state = freshState();
      this.pendingOffline = null;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      this.recalc();
    }
  };

  global.Game = Game;
})(window);
