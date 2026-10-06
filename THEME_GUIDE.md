# Theme controls

Edit `assets/css/theme.css`, save it, and reload the page. All homepage colors are grouped there by purpose, with a comment on each variable. If the browser shows an older version, use a hard refresh.

- `--page-bg`: background around the cards.
- `--tile-bg`: main card backgrounds.
- `--accent`: links and gold accent details.
- `--repository-bg`: dark repository tiles.
- `--banner-height`: desktop banner minimum height (currently `65vh`).
- `--banner-height-mobile`: banner minimum height at widths up to 640px (currently `70vh`).
- `--cloud-color-deep`, `--cloud-color-blue`, `--cloud-color-warm`, `--cloud-color-light`: the four cloud shader color stops, from darkest to lightest.
- `--cloud-brightness`: brightness multiplier applied after blending the colors.
- `--cloud-parallax`: response to scrolling.
- `--oracle-noise-dark` and `--oracle-noise-light`: endpoints for the coin/oracle noise.

For example, try `--tile-bg: #fff9ee;` or `--banner-height: 50vh;`. Reducing the banner height substantially may crowd its text, especially on mobile.

The neural network miniatures use a named palette. Translucent variants derive from that palette using `color-mix`, so changing `--network-blue` also changes its translucent edges. You may edit these variants individually too.

`main.css` imports the theme. Inline SVGs use the same variables directly. `theme.js` resolves colors and numeric settings for WebGL at initialization, so reload after changing them. No build step is required.

The controls cover the homepage and its embedded graphics; standalone network articles and the trading game's internal canvas retain their own styling. Pixels inside images, logos, PDFs and videos are edited in those source media, rather than with CSS.
