/* Number formatting and small shared helpers. */
(function (global) {
  'use strict';

  // K, M, B, T then aa, ab, ac … — the incremental-game convention.
  var SHORT = ['', 'K', 'M', 'B', 'T'];
  var LETTERS = 'abcdefghijklmnopqrstuvwxyz';

  function suffixFor(tier) {
    if (tier < SHORT.length) return SHORT[tier];
    var i = tier - SHORT.length;               // 0 -> 'aa'
    var first = Math.floor(i / 26);
    var second = i % 26;
    return LETTERS[first % 26] + LETTERS[second];
  }

  function fmt(n, decimals) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n, decimals);
    if (n < 1000) {
      if (n === 0) return '0';
      if (n < 10) return trim(n.toFixed(decimals == null ? 2 : decimals));
      if (n < 100) return trim(n.toFixed(1));
      return String(Math.floor(n));
    }
    var tier = Math.floor(Math.log10(n) / 3);
    var scaled = n / Math.pow(1000, tier);
    var s = round(scaled);
    // Rounding can carry into the next tier (999.9999K must read as 1M).
    if (parseFloat(s) >= 1000) {
      tier += 1;
      scaled /= 1000;
      s = round(scaled);
    }
    return trim(s) + suffixFor(tier);
  }

  function round(scaled) {
    return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0);
  }

  function trim(s) {
    return s.indexOf('.') === -1 ? s : s.replace(/\.?0+$/, '');
  }

  function fmtRate(n) {
    return fmt(n) + '/s';
  }

  function fmtTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + s + 's';
    return s + 's';
  }

  /** Cost of buying `count` items of a geometric price curve. */
  function bulkCost(base, growth, owned, count) {
    // base * growth^owned * (growth^count - 1) / (growth - 1)
    return base * Math.pow(growth, owned) * (Math.pow(growth, count) - 1) / (growth - 1);
  }

  /** How many you can afford, given a geometric curve. Returns >= 0. */
  function maxAffordable(base, growth, owned, matter) {
    var start = base * Math.pow(growth, owned);
    if (matter < start) return 0;
    var n = Math.floor(
      Math.log((matter * (growth - 1)) / start + 1) / Math.log(growth)
    );
    // Guard against log drift by stepping back until it truly fits.
    while (n > 0 && bulkCost(base, growth, owned, n) > matter) n--;
    return n;
  }

  global.Fmt = {
    n: fmt,
    rate: fmtRate,
    time: fmtTime,
    bulkCost: bulkCost,
    maxAffordable: maxAffordable
  };
})(window);
