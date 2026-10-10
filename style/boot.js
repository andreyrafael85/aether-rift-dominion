document.getElementById('b-night').addEventListener('click', e => { ARD.scene.state.night = !ARD.scene.state.night; e.target.classList.toggle('on', ARD.scene.state.night); });
document.getElementById('b-grid').addEventListener('click', e => { ARD.scene.state.grid = !ARD.scene.state.grid; e.target.classList.toggle('on', ARD.scene.state.grid); });
window.addEventListener('error', e => { const d = document.createElement('pre'); d.id = 'err'; d.style.cssText = 'position:fixed;left:8px;bottom:8px;background:#5a1d1d;color:#fff;padding:6px;z-index:9'; d.textContent = 'Erro: ' + e.message + ' @' + e.lineno; document.body.appendChild(d); });
if (new URLSearchParams(location.search).get('night')) { ARD.scene.state.night = true; document.getElementById('b-night').classList.add('on'); }
requestAnimationFrame(ARD.scene.draw);
