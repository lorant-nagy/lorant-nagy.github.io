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
  min-height: 30vh;
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

/* Split container for game section - 30% info, 70% game */
.split-container {
  display: flex;
  gap: 2em;
  max-width: 1600px;
  margin: 2em auto;
  align-items: flex-start;
}

.publication-info {
  flex: 0 0 28%;
  padding: 1.5em;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.publication-info h3 {
  margin-top: 0;
  color: #333;
  font-size: 1.3em;
  margin-bottom: 0.5em;
}

.publication-info p {
  color: #555;
  line-height: 1.6;
  margin-bottom: 1em;
  font-size: 0.95em;
}

.publication-info ul {
  color: #555;
  line-height: 1.8;
  font-size: 0.9em;
  padding-left: 1.2em;
}

.publication-info li {
  margin-bottom: 0.5em;
}

.publication-info .paper-link {
  display: inline-block;
  margin-top: 1em;
  padding: 0.5em 1em;
  background-color: #007acc;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
  font-size: 0.9em;
}

.publication-info .paper-link:hover {
  background-color: #005a9c;
}

.comic-placeholder {
  margin-top: 1.5em;
  padding: 1.5em;
  background-color: #e8e8e8;
  border: 2px dashed #999;
  border-radius: 8px;
  text-align: center;
  color: #666;
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9em;
}

.game-wrapper {
  flex: 0 0 68%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.game-wrapper h3 {
  margin-top: 0;
  margin-bottom: 1em;
  color: #333;
  font-size: 1.5em;
  text-align: center;
}

#game-container {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  overflow: visible;
}

#game-container canvas {
  max-width: 100%;
  height: auto !important;
}

/* Responsive design */
@media (max-width: 1024px) {
  .split-container {
    flex-direction: column;
  }
  
  .publication-info,
  .game-wrapper {
    flex: 0 0 100%;
  }
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
    <h2 style="text-align:center;">Trading Game</h2>
    
    <div class="split-container">
      
      <div class="publication-info">
        <h3>Based on Research</h3>
        <p>
          <strong>Paper:</strong> Nagy, L. & Rásonyi, M. (2025)<br>
          <em>"On the utility problem in a market where price impact is transient"</em><br>
          arXiv:2511.12093v1
        </p>
        <p>
          This interactive game demonstrates the mathematical model of market microstructure 
          where traders face transient price impact. The model captures:
        </p>
        <ul>
          <li><strong>Dynamic spreads:</strong> Bid-ask spreads widen with trades and recover over time</li>
          <li><strong>Market primitives:</strong> Price evolution, depth (liquidity), and resilience</li>
          <li><strong>High-frequency trading:</strong> Multiple trades between market updates</li>
          <li><strong>Strategic competition:</strong> You trade against a rule-based agent</li>
        </ul>
        <a href="https://arxiv.org/abs/2511.12093" class="paper-link" target="_blank">Read the Paper →</a>
        
        <div class="comic-placeholder">
          <p><em>Comic illustration coming soon...<br>Explaining model features visually</em></p>
        </div>
      </div>
      
      <div class="game-wrapper">
        <h3>Try the Game</h3>
        <div id="game-container">
          <!-- p5 canvas will be inserted here -->
        </div>
      </div>
      
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
<script src="{{ '/assets/js/game-single-file.js' | relative_url }}"></script>