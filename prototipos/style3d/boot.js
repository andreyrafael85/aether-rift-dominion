window.addEventListener('error', e => { const d = document.createElement('pre'); d.id = 'err'; d.textContent = 'Erro: ' + e.message + ' @' + e.lineno; document.body.appendChild(d); });
if (typeof THREE === 'undefined') { const d = document.createElement('pre'); d.id = 'err'; d.textContent = 'Three.js não carregou (CDN bloqueada?).'; document.body.appendChild(d); }
else {
  const scene = ARD.scene3d.create(document.getElementById('c'));
  document.getElementById('b-night').addEventListener('click', e => { scene.setNight(!scene.state.night); e.target.classList.toggle('on', scene.state.night); });
  document.getElementById('b-shadow').addEventListener('click', e => { scene.setShadows(!scene.state.shadows); e.target.classList.toggle('on', scene.state.shadows); });
  document.getElementById('b-orbit').addEventListener('click', e => { scene.state.orbit = !scene.state.orbit; e.target.classList.toggle('on', scene.state.orbit); });
  if (new URLSearchParams(location.search).get('night')) { scene.setNight(true); document.getElementById('b-night').classList.add('on'); }
  scene.start();
}
