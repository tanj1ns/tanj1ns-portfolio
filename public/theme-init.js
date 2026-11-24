(function () {
  try {
    var m = document.cookie.match(/(?:^|; )tanj1ns_theme=(light|dark)(?:;|$)/);
    var t = (m && m[1]) || localStorage.getItem('tanj1ns_theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
