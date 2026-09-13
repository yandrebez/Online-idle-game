/* =============================================================================
   Ads layer — consent gate, banner injection, rewarded video.
   Everything the game touches goes through Ads.*, so swapping networks later
   never means touching game code.
   ========================================================================== */
(function (global) {
  'use strict';

  var CFG = global.AD_CONFIG || { enabled: false, behaviour: {} };
  var CONSENT_KEY = 'nanoforge.consent.v1';

  // Regions where we must ask before loading personalised ad scripts.
  // Timezone sniffing is a heuristic, not law — when unsure we ask anyway.
  function likelyNeedsConsent() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^(Europe|Atlantic\/(Azores|Canary|Faroe|Madeira|Reykjavik))/.test(tz);
    } catch (e) {
      return true;
    }
  }

  var Ads = {
    consent: null,        // 'granted' | 'denied' | null
    networksLoaded: false,
    lastInterstitial: 0,
    _rewardedInFlight: false,

    init: function () {
      this.consent = this._readConsent();

      if (!CFG.enabled) { this._renderHouse(); return; }

      if (!CFG.requireConsent || !likelyNeedsConsent()) {
        this.consent = this.consent || 'granted';
      }

      if (this.consent === 'granted') {
        this._loadNetworks();
      } else if (this.consent === 'denied') {
        this._renderHouse();
      } else {
        this._showConsentBanner();
        this._renderHouse();   // keep layout stable while we wait
      }
    },

    /* ----------------------------------------------------------- consent -- */

    _readConsent: function () {
      try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
    },

    _writeConsent: function (v) {
      this.consent = v;
      try { localStorage.setItem(CONSENT_KEY, v); } catch (e) { /* private mode */ }
    },

    _showConsentBanner: function () {
      var el = document.getElementById('consent');
      if (!el) return;
      el.hidden = false;
      var self = this;
      el.querySelector('[data-consent="accept"]').addEventListener('click', function () {
        self._writeConsent('granted');
        el.hidden = true;
        self._loadNetworks();
      });
      el.querySelector('[data-consent="reject"]').addEventListener('click', function () {
        self._writeConsent('denied');
        el.hidden = true;
        self._renderHouse();
      });
    },

    /* ---------------------------------------------------------- networks -- */

    _loadNetworks: function () {
      if (this.networksLoaded) return;
      this.networksLoaded = true;

      this._loadAdsense();
      this._loadAdsterra();
      this._loadMonetag();

      // Nothing configured yet? Show house creatives so the layout is final
      // and you can see exactly where real ads will land.
      if (!this._anyBannerNetwork()) this._renderHouse();
    },

    _anyBannerNetwork: function () {
      var a = CFG.adsense || {}, t = CFG.adsterra || {};
      return !!(a.client || t.bannerKey || t.nativeContainer);
    },

    _script: function (attrs, inlineCode) {
      var s = document.createElement('script');
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === 'async' || k === 'defer') { s[k] = true; return; }
        s.setAttribute(k, attrs[k]);
      });
      if (inlineCode) s.text = inlineCode;
      document.head.appendChild(s);
      return s;
    },

    _loadAdsense: function () {
      var a = CFG.adsense || {};
      if (!a.client) return;

      this._script({
        async: true,
        src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
             encodeURIComponent(a.client),
        crossorigin: 'anonymous'
      });

      var slots = a.slots || {};
      if (slots.banner) this._mountAdsenseUnit('ad-footer', a.client, slots.banner, true);
      if (slots.rectangle) this._mountAdsenseUnit('ad-rail', a.client, slots.rectangle, false);
    },

    _mountAdsenseUnit: function (hostId, client, slot, responsive) {
      var host = document.getElementById(hostId);
      if (!host) return;
      host.dataset.claimed = 'adsense';   // keeps Adsterra and house ads off this slot
      host.innerHTML = '';
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', client);
      ins.setAttribute('data-ad-slot', slot);
      if (responsive) {
        ins.setAttribute('data-ad-format', 'horizontal');
        ins.setAttribute('data-full-width-responsive', 'true');
      } else {
        ins.style.width = '300px';
        ins.style.height = '250px';
      }
      host.appendChild(ins);
      try {
        (global.adsbygoogle = global.adsbygoogle || []).push({});
      } catch (e) { /* blocked by an extension — not our problem to solve */ }
    },

    _loadAdsterra: function () {
      var t = CFG.adsterra || {};
      var host = document.getElementById('ad-footer');
      // Adsterra only takes the footer slot when AdSense has not claimed it.
      if (!t.bannerKey || !host || host.dataset.claimed === 'adsense') return;
      if ((CFG.adsense || {}).slots && (CFG.adsense.slots.banner)) return;

      host.dataset.claimed = 'adsterra';
      host.innerHTML = '';

      // Adsterra's banner tag reads a global set immediately before its script.
      var frame = document.createElement('iframe');
      frame.className = 'ad-frame';
      frame.width = t.bannerWidth || 728;
      frame.height = t.bannerHeight || 90;
      frame.scrolling = 'no';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('title', 'Advertisement');
      host.appendChild(frame);

      var doc = frame.contentWindow.document;
      doc.open();
      doc.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body>' +
        '<script>window.atOptions=' + JSON.stringify({
          key: t.bannerKey,
          format: 'iframe',
          height: t.bannerHeight || 90,
          width: t.bannerWidth || 728,
          params: {}
        }) + ';<\/script>' +
        '<script src="//www.highperformanceformat.com/' +
        encodeURIComponent(t.bannerKey) + '/invoke.js"><\/script>' +
        '</body></html>'
      );
      doc.close();
    },

    _loadMonetag: function () {
      var m = CFG.monetag || {};
      if (!m.rewardedZone) return;
      // Monetag's SDK defines a global show_<zone>() we call for rewarded views.
      this._script({
        src: 'https://' + (m.sdkDomain || 'vemtoutcheeg.com') + '/sdk.js',
        'data-zone': String(m.rewardedZone),
        'data-sdk': 'show_' + m.rewardedZone,
        async: true
      });
    },

    /* ------------------------------------------------------- house ads --- */

    _renderHouse: function () {
      ['ad-footer', 'ad-rail'].forEach(function (id) {
        var host = document.getElementById(id);
        if (!host || host.dataset.claimed) return;
        if (host.children.length && host.dataset.house === '1') return;
        host.dataset.house = '1';
        host.innerHTML =
          '<div class="house-ad">' +
          '<strong>Ad space</strong>' +
          '<span>' + (id === 'ad-rail' ? '300 × 250' : 'Banner') + '</span>' +
          '</div>';
      });
    },

    /* --------------------------------------------------------- rewarded -- */

    /**
     * Show a rewarded ad and resolve true if the reward was earned.
     * Never rejects — callers only care about "did they earn it".
     */
    rewarded: function (label) {
      var self = this;
      var beh = CFG.behaviour || {};

      if (this._rewardedInFlight) return Promise.resolve(false);
      this._rewardedInFlight = true;

      var done = function (ok) {
        self._rewardedInFlight = false;
        return ok;
      };

      var m = CFG.monetag || {};
      var fn = m.rewardedZone && global['show_' + m.rewardedZone];

      if (this.consent !== 'granted' || typeof fn !== 'function') {
        return this._houseRewarded(label).then(function () {
          return done(beh.grantRewardOnNoFill !== false);
        });
      }

      return Promise.resolve()
        .then(function () { return fn(); })
        .then(function () { return done(true); })
        .catch(function () {
          // No fill, or the user closed it early.
          return done(beh.grantRewardOnNoFill !== false);
        });
    },

    /**
     * Fallback "ad" used before ad accounts exist, or on a no-fill.
     * A short branded wait so the reward still feels earned.
     */
    _houseRewarded: function (label) {
      return new Promise(function (resolve) {
        var modal = document.getElementById('rewarded-modal');
        if (!modal) { resolve(); return; }

        var bar = modal.querySelector('.rw-bar span');
        var txt = modal.querySelector('.rw-label');
        var skip = modal.querySelector('.rw-skip');

        txt.textContent = label || 'Loading reward…';
        bar.style.transition = 'none';
        bar.style.width = '0%';
        modal.hidden = false;
        skip.disabled = true;
        skip.textContent = 'Please wait…';

        var DURATION = 3000;
        requestAnimationFrame(function () {
          bar.style.transition = 'width ' + DURATION + 'ms linear';
          bar.style.width = '100%';
        });

        var t = setTimeout(function () {
          skip.disabled = false;
          skip.textContent = 'Collect reward';
        }, DURATION);

        skip.onclick = function () {
          if (skip.disabled) return;
          clearTimeout(t);
          modal.hidden = true;
          skip.onclick = null;
          resolve();
        };
      });
    },

    /* ----------------------------------------------------- interstitial -- */

    interstitial: function () {
      var beh = CFG.behaviour || {};
      var cool = (beh.interstitialCooldownSec || 180) * 1000;
      var now = Date.now();
      if (now - this.lastInterstitial < cool) return Promise.resolve(false);
      if (this.consent !== 'granted') return Promise.resolve(false);

      var m = CFG.monetag || {};
      var zone = m.interstitialZone || m.rewardedZone;
      var fn = zone && global['show_' + zone];
      if (typeof fn !== 'function') return Promise.resolve(false);

      this.lastInterstitial = now;
      return Promise.resolve()
        .then(function () { return fn(); })
        .then(function () { return true; })
        .catch(function () { return false; });
    }
  };

  global.Ads = Ads;
})(window);
