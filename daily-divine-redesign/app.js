/* Daily Divine redesign prototype — routing, tabs, toasts, screen behavior. */
(function () {
  'use strict';

  var SCREENS = [
    'welcome', 'daily', 'add-sign', 'guidance', 'moon', 'intention',
    'deck', 'card-detail', 'profile', 'personalization', 'prompt-settings',
    'premium', 'settings', 'admin', 'users'
  ];

  var TITLES = {
    'welcome': 'Welcome', 'daily': 'Today', 'add-sign': 'New Sign',
    'guidance': 'Guidance', 'moon': 'Moon Phase', 'intention': 'Intention',
    'deck': 'Your Deck', 'card-detail': 'Oracle Card', 'profile': 'Profile',
    'personalization': 'Personalization', 'prompt-settings': 'Daily Reminder',
    'premium': 'Divine Plus', 'settings': 'Settings', 'admin': 'Admin',
    'users': 'Users'
  };

  /* Which bottom tab lights up for each screen. */
  var TAB_FOR_SCREEN = {
    'daily': 'daily', 'add-sign': 'daily', 'guidance': 'daily', 'intention': 'daily',
    'moon': 'moon',
    'deck': 'deck', 'card-detail': 'deck',
    'profile': 'profile', 'personalization': 'profile', 'prompt-settings': 'profile',
    'premium': 'profile', 'settings': 'profile', 'admin': 'profile', 'users': 'profile'
  };

  var phone = document.getElementById('phone');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function currentScreen() {
    var key = new URLSearchParams(window.location.search).get('screen');
    return SCREENS.indexOf(key) !== -1 ? key : 'welcome';
  }

  function showScreen(key) {
    document.querySelectorAll('.screen').forEach(function (s) {
      var active = s.getAttribute('data-screen') === key;
      s.classList.toggle('active', active);
      if (active) { s.scrollTop = 0; }
    });
    phone.classList.toggle('no-tabs', key === 'welcome');
    var tab = TAB_FOR_SCREEN[key];
    document.querySelectorAll('.tabbar a[data-tab]').forEach(function (a) {
      if (a.getAttribute('data-tab') === tab) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
    document.title = 'Daily Divine — ' + (TITLES[key] || 'Prototype');
  }

  function toast(message) {
    if (!message) { return; }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2400);
  }

  function navigate(key) {
    window.location.search = '?screen=' + key;
  }

  /* --- boot: route + show any toast handed off from the previous screen --- */
  showScreen(currentScreen());
  try {
    var pending = sessionStorage.getItem('dd-toast');
    if (pending) {
      sessionStorage.removeItem('dd-toast');
      setTimeout(function () { toast(pending); }, 250);
    }
  } catch (e) { /* private mode: toasts just don't carry across navigation */ }

  /* --- global click handling: toasts, nav buttons, chips, switches --- */
  document.addEventListener('click', function (event) {
    var el = event.target.closest('button');
    if (!el) { return; }

    /* toast + optional navigation handoff */
    var msg = el.getAttribute('data-toast');
    var nav = el.getAttribute('data-nav');
    if (msg && nav) {
      try { sessionStorage.setItem('dd-toast', msg); } catch (e) { /* ignore */ }
      navigate(nav);
      return;
    }
    if (nav) { navigate(nav); return; }
    if (msg) { toast(msg); }

    /* chips: single-select within their group */
    if (el.classList.contains('chip')) {
      el.parentElement.querySelectorAll('.chip').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === el));
      });
      return;
    }

    /* segmented controls: single-select */
    if (el.parentElement && el.parentElement.classList.contains('segmented')) {
      el.parentElement.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === el));
      });
      return;
    }

    /* plan picker (premium): single-select */
    if (el.classList.contains('plan')) {
      document.querySelectorAll('.plan').forEach(function (p) {
        p.setAttribute('aria-pressed', String(p === el));
      });
      return;
    }

    /* iOS-style switches */
    if (el.classList.contains('switch')) {
      var on = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(on));
      var user = el.getAttribute('data-user');
      if (user) {
        toast(on ? 'Premium granted to ' + user + ' ✧' : 'Premium removed from ' + user);
      }
    }
  });

  /* --- card detail: keep/remove + regenerate mantra --- */
  var keepBtn = document.getElementById('card-keep');
  if (keepBtn) {
    keepBtn.addEventListener('click', function () {
      var keeping = keepBtn.getAttribute('aria-pressed') !== 'true';
      keepBtn.setAttribute('aria-pressed', String(keeping));
      keepBtn.textContent = keeping ? '✓ In your deck' : '＋ Add to deck';
      toast(keeping
        ? keepBtn.getAttribute('data-toast-on')
        : keepBtn.getAttribute('data-toast-off'));
    });
  }

  var MANTRAS = [
    '“What is meant for you circles back softly, as many times as you need.”',
    '“You don’t have to chase the light — you only have to face it.”',
    '“The answer keeps arriving because you are finally ready to hear it.”',
    '“Every return is an invitation, not a coincidence.”'
  ];
  var mantraIndex = 0;
  var regenBtn = document.getElementById('card-regenerate');
  var mantraEl = document.getElementById('card-mantra');
  if (regenBtn && mantraEl) {
    regenBtn.addEventListener('click', function () {
      mantraIndex = (mantraIndex + 1) % MANTRAS.length;
      mantraEl.textContent = MANTRAS[mantraIndex];
      toast('A new mantra was written for this card ✦');
    });
  }

  /* --- settings: delete account confirm --- */
  var deleteBtn = document.getElementById('delete-account');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function () {
      var sure = window.confirm(
        'Delete your account? Your journal, signs, and oracle deck will be permanently removed.');
      if (sure) {
        try { sessionStorage.setItem('dd-toast', 'Your account has been deleted.'); } catch (e) { /* ignore */ }
        navigate('welcome');
      }
    });
  }

  /* --- users: search filter + sort --- */
  var userSearch = document.getElementById('user-search');
  var userSort = document.getElementById('user-sort');
  var userList = document.getElementById('user-list');
  var userNote = document.getElementById('user-count-note');

  function refreshUsers() {
    if (!userList) { return; }
    var rows = Array.prototype.slice.call(userList.querySelectorAll('.switch-row'));
    var query = (userSearch && userSearch.value || '').trim().toLowerCase();
    var visible = 0;
    rows.forEach(function (row) {
      var match = row.textContent.toLowerCase().indexOf(query) !== -1;
      row.style.display = match ? '' : 'none';
      if (match) { visible += 1; }
    });
    var mode = userSort ? userSort.value : 'recent';
    rows.sort(function (a, b) {
      if (mode === 'signs') {
        return Number(b.getAttribute('data-signs')) - Number(a.getAttribute('data-signs'));
      }
      if (mode === 'name') {
        return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
      }
      return Number(a.getAttribute('data-recency')) - Number(b.getAttribute('data-recency'));
    });
    rows.forEach(function (row) { userList.appendChild(row); });
    if (userNote) {
      userNote.textContent = query
        ? 'Showing ' + visible + ' matching user' + (visible === 1 ? '' : 's')
        : 'Showing ' + visible + ' of 3,208 users';
    }
  }

  if (userSearch) { userSearch.addEventListener('input', refreshUsers); }
  if (userSort) { userSort.addEventListener('change', refreshUsers); }
})();
