// Общий frontend скрипт для публичной страницы и простых admin-взаимодействий
(async function() {
  // Public page code only runs on index.html
  if (document.getElementById('tracks')) {
    const tracksContainer = document.getElementById('tracks');
    const albumsContainer = document.getElementById('albums');

    const playerEl = document.getElementById('player');
    const audio = document.getElementById('audio');
    const playBtn = document.getElementById('play');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const rewBtn = document.getElementById('rew');
    const fwdBtn = document.getElementById('fwd');
    const volume = document.getElementById('volume');
    const downloadLink = document.getElementById('download');
    const coverImg = document.getElementById('player-cover-img');
    const titleEl = document.getElementById('player-title');
    const artistEl = document.getElementById('player-artist');
    const lyricsEl = document.getElementById('lyrics');

    let tracks = [];
    let albums = [];
    let currentIndex = -1;

    async function load() {
      tracks = await (await fetch('/api/tracks')).json();
      albums = await (await fetch('/api/albums')).json();
      render();
    }

    function render() {
      albumsContainer.innerHTML = '';
      albums.forEach(a => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `<strong>${escapeHtml(a.name)}</strong>`;
        albumsContainer.appendChild(el);
      });

      tracksContainer.innerHTML = '';
      tracks.forEach((t, idx) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
          ${t.cover ? `<img src="/uploads/${t.cover}">` : ''}
          <h4>${escapeHtml(t.title)}</h4>
          <div>${escapeHtml(t.artist || '')}</div>
          <div>
            <button data-play="${t.id}">Დასაფრენი</button>
            <a href="/uploads/${t.filename}" download>ჩამოტვირთვა</a>
            <button data-like="${t.id}">❤ <span>${t.likes||0}</span></button>
          </div>
        `;
        // show lyrics on click
        el.querySelector('[data-play]') && el.querySelector('[data-play]').addEventListener('click', () => {
          startPlayingById(t.id);
        });
        el.querySelector('[data-like]') && el.querySelector('[data-like]').addEventListener('click', async (e) => {
          const res = await fetch(`/api/tracks/${t.id}/like`, { method: 'POST' });
          const json = await res.json();
          e.currentTarget.querySelector('span').textContent = json.likes;
        });
        tracksContainer.appendChild(el);
      });
    }

    function startPlayingById(id) {
      currentIndex = tracks.findIndex(x => x.id === id);
      if (currentIndex === -1) return;
      const t = tracks[currentIndex];
      playTrack(t);
    }

    function playTrack(t) {
      audio.src = `/media/${t.filename}`;
      audio.play();
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist || '';
      lyricsEl.textContent = t.lyrics || '';
      if (t.cover) coverImg.src = `/uploads/${t.cover}`; else coverImg.src = '';
      downloadLink.href = `/uploads/${t.filename}`;
      playerEl.classList.remove('hidden');
      playBtn.textContent = '⏸';
    }

    playBtn && playBtn.addEventListener('click', () => {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    prevBtn && prevBtn.addEventListener('click', () => {
      if (tracks.length === 0) return;
      currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      playTrack(tracks[currentIndex]);
    });
    nextBtn && nextBtn.addEventListener('click', () => {
      if (tracks.length === 0) return;
      currentIndex = (currentIndex + 1) % tracks.length;
      playTrack(tracks[currentIndex]);
    });
    rewBtn && rewBtn.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
    fwdBtn && fwdBtn.addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    volume && volume.addEventListener('input', () => { audio.volume = volume.value; });

    audio.addEventListener('play', () => { playerEl.classList.remove('hidden'); playBtn.textContent = '⏸'; });
    audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
    audio.addEventListener('ended', () => {
      // hide player if stopped
      playerEl.classList.add('hidden');
      audio.src = '';
      currentIndex = -1;
    });

    // Escape helper
    function escapeHtml(s){ return (s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

    await load();
  }

  // Admin page admin.js is loaded separately (see admin.html)
})();
