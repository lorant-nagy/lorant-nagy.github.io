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
  background-position: center 25%;
  background-size: cover;
  min-height: 65vh;
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

/* Split container for game section - 30% comic, 70% game */
.split-container {
  display: flex;
  gap: 2em;
  max-width: 1600px;
  margin: 2em auto;
  align-items: flex-start;
}

.publication-info {
  flex: 0 0 30%;
  display: flex;
  flex-direction: column;
}

.citation {
  padding: 1em;
  background-color: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 1em;
  font-size: 0.9em;
  color: #333;
  line-height: 1.6;
}

.citation a {
  color: #007acc;
  text-decoration: none;
}

.citation a:hover {
  text-decoration: underline;
}

.comic-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.comic-container img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: transform 0.3s ease;
}

.comic-container img:hover {
  transform: scale(1.02);
}

/* Modal for enlarged comic */
.modal {
  display: none;
  position: fixed;
  z-index: 9999;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: transparent;
  cursor: pointer;
}

.modal-content {
  display: block;
  max-width: 90%;
  max-height: 90vh;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  object-fit: contain;
}

.game-wrapper {
  flex: 0 0 66%;
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
    
    <div class="split-container">
      
      <div class="publication-info">
        <div class="citation">
          Nagy, L. & Rásonyi, M. (2025). <em>On the utility problem in a market where price impact is transient</em>. arXiv:2511.12093 [<a href="https://arxiv.org/abs/2511.12093" target="_blank">link</a>]
        </div>
        
        <div class="comic-container" onclick="openModal()">
          <img src="/assets/images/comic0.png" alt="Trading Game Comic" id="comicImg">
        </div>
      </div>
      
      <div class="game-wrapper">
        <div id="game-container">
          <!-- p5 canvas will be inserted here -->
        </div>
      </div>
      
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
<script src="{{ '/assets/js/game-single-file.js' | relative_url }}"></script>

<!-- Modal for enlarged comic -->
<div id="comicModal" class="modal" onclick="closeModal()">
  <img class="modal-content" id="modalImg">
</div>

<script>
function openModal() {
  const modal = document.getElementById('comicModal');
  const modalImg = document.getElementById('modalImg');
  const comicImg = document.getElementById('comicImg');
  
  modal.style.display = 'block';
  modalImg.src = comicImg.src;
}

function closeModal() {
  document.getElementById('comicModal').style.display = 'none';
}
</script>