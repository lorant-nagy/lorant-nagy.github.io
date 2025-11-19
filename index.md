---
layout: single
title: ""
classes: wide
---

<style>

.game-section {
  background-color: #ffffff;
  padding: 4em 2em;
  min-height: 50vh;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

/* Push header content to edges */
.masthead__inner-wrap {
  padding-left: 1em;
  padding-right: 1em;
  max-width: 100% !important;
  padding-top: 0;
  padding-bottom: 0;
}

.masthead__menu {
  width: 100%;
}

.greedy-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.site-title {
  margin-right: auto;
}

.masthead-contact {
  text-align: right;
  padding: 0.5em 1em;
  margin-left: auto;
}


.masthead {
  background-color: #fff;
  background-image: none !important;
  border-bottom: none !important;
  min-height: auto;
}

.masthead-contact {
  text-align: right;
  padding: 0.5em 1em;
}

.masthead__inner-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Hide background in footer */
.page__footer {
  background-color: #fff;
  background-image: none !important;
}

/* Remove container padding to make sections full width */
.page__content {
  margin: 0 !important;
  padding: 0 !important;
  max-width: 100% !important;
}

.page {
  width: 100% !important;
  padding: 0 !important;
}

/* Welcome section - transparent with parallax effect */
.welcome-section {
  background-image: url('/assets/images/background.png');
  background-attachment: fixed;
  background-position: center;
  background-size: cover;
  min-height: 10vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

/* Works section - solid background */
.works-section {
  background-color: #f5f5f5;
  padding: 4em 2em;
  min-height: 50vh;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}
</style>

<div class="welcome-section">
  <div style="text-align: center; max-width: 800px; padding: 2em; line-height: 1.2;">
    <div style="font-size: 3em;"><span style="font-size: 0.5em;">some &nbsp;</span> OR &nbsp;&nbsp;&nbsp; AI &nbsp;&nbsp;&nbsp; ML</div>
    <div style="font-size: 2em; letter-spacing: 0.2em;">&#8202;F&thinsp; i n - M a t &thinsp;h</div>
  </div>
</div>

<div class="works-section">
  <h2 style="text-align: center; font-size: 2.5em; margin-bottom: 1em;">UNDER CONSTRUCTION</h2>
  
  <div class="game-section">
    <h2 style="text-align:center;">Trajectory Forecast Game</h2>
    <p style="text-align:center;">Interactive experiment coming here...</p>
    <div id="game-container" style="display:flex; justify-content:center; padding:1em;">
      <!-- p5 canvas will live here -->
    </div>
  </div>

</div>