---
layout: single
title: ""
classes: wide
---

<style>

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

/* Custom header section */
.custom-header {
  background-color: #fff;
  padding: 1em 2em;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

.site-title-custom {
  font-size: 1.5em;
  font-weight: bold;
  color: #333;
  text-decoration: none;
}

.header-contact {
  text-align: right;
  font-size: 0.75em;
  line-height: 1.4;
  color: #555;
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
  padding: 1em 2em;
  min-height: 50vh;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

.game-section {
  background-color: #ffffff;
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
  margin: 0.5em auto;
  align-items: center;
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
.comic-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99999999 !important;
  background-color: rgba(0,0,0,0.85);
  cursor: pointer;
  justify-content: center;
  align-items: center;
}

.comic-modal img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border: none;
  outline: none;
  box-shadow: none;
}

.game-wrapper {
  flex: 0 0 66%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

/* Custom footer section */
.custom-footer {
  background-color: #fff;
  padding: 2em;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
}

.footer-title {
  font-size: 1.5em;
  margin: 0 0 0.5em 0;
  text-align: center;
}

.social-icons {
  text-align: center;
  list-style: none;
  padding: 0;
  margin: 0;
}

.social-icons li {
  display: inline-block;
  margin: 0 15px;
  vertical-align: middle;
}

.social-icons a {
  color: #333;
  transition: color 0.3s;
}

.social-icons a:hover {
  color: #007acc;
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
  
  .custom-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-contact {
    text-align: left;
    margin-top: 1em;
  }
}

</style>

<!-- Custom Header -->
<div class="custom-header">
  <a class="site-title-custom" href="/">Lóránt Nagy</a>
  <div class="header-contact">
    HUN-REN Rényi Institute of Mathematics<br>
    Budapest, Reáltanoda utca 13-15, 1053<br>
    <br>
    lorantnagy at renyi hu
  </div>
</div>

<div class="welcome-section">
  <div style="text-align: center; max-width: 800px; padding: 2em; line-height: 1.2;">
    <div style="font-size: 3em;">
      <span style="font-size: 0.5em;">some &nbsp;</span> OR &nbsp;&nbsp;&nbsp; AI &nbsp;&nbsp;&nbsp; ML
    </div>
    <div style="font-size: 2em; letter-spacing: 0.2em;">
      &#8202;F&thinsp; i n - M a t &thinsp;h
    </div>
  </div>
</div>

<div class="works-section">
  <div class="game-section">
    <div class="split-container">
      
      <div class="publication-info">
        <div class="citation">
          Nagy, L. &amp; Rásonyi, M. (2025).
          <em>On the utility problem in a market where price impact is transient</em>.
          arXiv:2511.12093 [<a href="https://arxiv.org/abs/2511.12093" target="_blank" rel="noopener">arxiv</a>]
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

<!-- Custom Footer -->
<div class="custom-footer">
  <p class="footer-title">c o n n e c t</p>
  <ul class="social-icons">
    <li><a href="https://github.com/lorant-nagy" target="_blank" title="GitHub"><i class="fab fa-fw fa-github" aria-hidden="true" style="font-size: 4em;"></i></a></li>
    <li><a href="https://instagram.com/lowcy_me_is" target="_blank" title="Instagram"><i class="fab fa-fw fa-instagram" aria-hidden="true" style="font-size: 4em;"></i></a></li>
    <li><a href="https://linkedin.com/in/lóránt-nagy-87b5a0101" target="_blank" title="LinkedIn"><i class="fab fa-fw fa-linkedin" aria-hidden="true" style="font-size: 4em;"></i></a></li>
    <li><a href="https://m2.mtmt.hu/gui2/?type=authors&mode=browse&sel=10076737" target="_blank" title="MTMT"><img src="/assets/images/mtmt_logo.png" alt="MTMT" style="width: 4em; height: 4em; display: inline-block;"></a></li>
  </ul>
</div>

<script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
<script src="{{ '/assets/js/game-single-file.js' | relative_url }}"></script>

<!-- Modal for enlarged comic -->
<div id="comicModal" class="comic-modal" onclick="closeModal()">
  <img id="modalImg" alt="Enlarged comic">
</div>

<script>
function openModal() {
  const modal = document.getElementById('comicModal');
  const modalImg = document.getElementById('modalImg');
  const comicImg = document.getElementById('comicImg');
  
  modal.style.display = 'flex';
  modalImg.src = comicImg.src;
}

function closeModal() {
  const modal = document.getElementById('comicModal');
  modal.style.display = 'none';
}
</script>