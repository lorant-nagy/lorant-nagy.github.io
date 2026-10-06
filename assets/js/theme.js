/* Read the central CSS theme for WebGL. Values are resolved at initialization;
 * reload after editing theme.css. CSS/SVG use the variables directly. */
window.SiteTheme = (() => {
  function number(name) {
    return Number(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }
  function rgb(name) {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255);
  }
  return { number, rgb };
})();
