// Sparkle generator
function createSparkle() {
  const sparkle = document.createElement('div');
  sparkle.classList.add('sparkle');
  sparkle.style.left = `${Math.random() * 100}%`;
  sparkle.style.top = `${Math.random() * 100}%`;
  sparkle.style.animationDuration = `${2 + Math.random() * 3}s`;
  document.querySelector('.sparkles').appendChild(sparkle);

  setTimeout(() => sparkle.remove(), 5000);
}

// Generate sparkles on interval
setInterval(createSparkle, 500);

// Fiesta Button
const fiestaBtn = document.querySelector('.btn');
fiestaBtn.addEventListener('click', () => {
  fiestaBtn.classList.add('bounce');
  console.log("🎺 ¡La fiesta ha comenzado, ese!");
  setTimeout(() => {
    fiestaBtn.classList.remove('bounce');
  }, 500);
});
