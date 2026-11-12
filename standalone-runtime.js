/* Standalone browser support for Fruit Slice. No portal SDKs or ad networks. */
(function () {
  'use strict';

  var prefix = 'fruit-slice:';
  var memory = Object.create(null);
  var storage = null;
  try { storage = window.localStorage; } catch (e) {}

  function gameKeys() {
    var keys = [];
    if (!storage) return Object.keys(memory);
    try {
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (key && key.indexOf(prefix) === 0) keys.push(key.slice(prefix.length));
      }
    } catch (e) {}
    return keys;
  }

  window.localStorageWrapper = {
    getItem: function (key) {
      key = String(key);
      try {
        var value = storage && storage.getItem(prefix + key);
        return value === null || value === undefined
          ? (Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null)
          : value;
      } catch (e) {
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      }
    },
    setItem: function (key, value) {
      key = String(key);
      value = String(value);
      memory[key] = value;
      try { if (storage) storage.setItem(prefix + key, value); } catch (e) {}
    },
    removeItem: function (key) {
      key = String(key);
      delete memory[key];
      try { if (storage) storage.removeItem(prefix + key); } catch (e) {}
    },
    clear: function () {
      memory = Object.create(null);
      gameKeys().forEach(function (key) {
        try { if (storage) storage.removeItem(prefix + key); } catch (e) {}
      });
    },
    key: function (index) { return gameKeys()[index] || null; }
  };
  Object.defineProperty(window.localStorageWrapper, 'length', {
    get: function () { return gameKeys().length; }
  });

  var contexts = [];
  var media = [];
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Original = window[name];
    if (!Original) return;
    function WrappedAudioContext() {
      var args = Array.prototype.slice.call(arguments);
      var context = new (Function.prototype.bind.apply(Original, [null].concat(args)))();
      contexts.push(context);
      if (document.hidden) {
        try { context.suspend(); } catch (e) {}
      }
      return context;
    }
    WrappedAudioContext.prototype = Original.prototype;
    try { window[name] = WrappedAudioContext; } catch (e) {}
  });

  if (window.HTMLMediaElement && HTMLMediaElement.prototype.play) {
    var originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (media.indexOf(this) < 0) media.push(this);
      if (document.hidden) this.muted = true;
      return originalPlay.apply(this, arguments);
    };
  }

  var paused = false;
  function setPaused(value) {
    value = !!value;
    if (paused === value) return;
    paused = value;
    try {
      if (window.egret && window.egret.ticker) {
        value ? window.egret.ticker.pause() : window.egret.ticker.resume();
      }
    } catch (e) {}
    contexts.forEach(function (context) {
      try { value ? context.suspend() : context.resume(); } catch (e) {}
    });
    media.forEach(function (element) {
      try { element.muted = value; } catch (e) {}
    });
  }

  document.addEventListener('visibilitychange', function () {
    setPaused(document.hidden);
  });
  window.addEventListener('blur', function () { setPaused(true); });
  window.addEventListener('focus', function () { setPaused(document.hidden); });
})();
