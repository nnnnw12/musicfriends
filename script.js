/**
 * MusicFriends Engine Ultimate + VIDEO BANNER SYSTEM
 * UPDATED: 2026 Compatible
 */

// --- 0. ПОДКЛЮЧЕНИЕ FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, push, remove } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC0U0fdnj4V1UJXiz_TVOhxmPlUk67r-xI",
    authDomain: "musicfriendsbro-893fb.firebaseapp.com",
    projectId: "musicfriendsbro-893fb",
    storageBucket: "musicfriendsbro-893fb.firebasestorage.app",
    messagingSenderId: "702623321390",
    appId: "1:702623321390:web:493acd08b641ec40d4bebf",
    measurementId: "G-HZ537XCYGV"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const globalSongsRef = ref(db, 'shared_songs'); 

// --- 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ ---

const STORAGE_KEYS = {
    PROFILE: 'mf_profile_v4',
    SETTINGS: 'mf_settings_v4',
    USER_ID: 'mf_user_uid_v4'
};

let songs = []; 
let songKeys = []; 
let userProfile = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE)) || {
    name: "Твой Ник",
    color: "#1db954",
    theme: "default",
    avatar: null,
    banner: null
};
let settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {
    volume: 0.7,
    isShuffle: false,
    isRepeat: false
};

const userId = localStorage.getItem(STORAGE_KEYS.USER_ID) || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem(STORAGE_KEYS.USER_ID, userId);

let currentSongIndex = -1;
let isPlaying = false;
let pendingFile = null;
const audio = new Audio();
audio.preload = "auto";
audio.volume = settings.volume;

const UI = {
    fileInput: document.getElementById('file-input'),
    songGrid: document.getElementById('song-grid'),
    playPauseBtn: document.getElementById('play-pause'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    shuffleBtn: document.querySelector('.fa-random')?.parentElement,
    repeatBtn: document.querySelector('.fa-redo')?.parentElement,
    progressBar: document.getElementById('progress-bar'),
    progressContainer: document.getElementById('progress-container'),
    volumeFill: document.getElementById('volume-fill'),
    volumeBg: document.getElementById('volume-bg'),
    uploadModal: document.getElementById('upload-modal'),
    profileModal: document.getElementById('profile-edit-modal'),
    currentCover: document.getElementById('current-cover'),
    displayName: document.getElementById('display-name'),
    displayArtist: document.getElementById('display-artist'),
    onlineCounter: document.getElementById('online-counter'),
    friendAvatars: document.getElementById('friend-avatars'),
    contentArea: document.querySelector('.content') // Для баннера
};

// --- 2. ИНИЦИАЛИЗАЦИЯ ---

window.addEventListener('DOMContentLoaded', () => {
    applyProfileStyles();
    initPlayerControls();
    initRealtimeFriends();

    onValue(globalSongsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            songKeys = Object.keys(data);
            songs = Object.values(data);
        } else {
            songKeys = [];
            songs = [];
        }
        renderLibrary();
    });

    // Обработка ввода ссылки на песню (авто-имя)
    const customUrlInput = document.getElementById('custom-url');
    if (customUrlInput) {
        customUrlInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const titleInput = document.getElementById('custom-title');
            if (val && !titleInput.value) {
                try {
                    let filename = val.split('/').pop().split('?')[0];
                    filename = decodeURIComponent(filename).replace('.mp3', '').replace(/_/g, ' ').replace(/-/g, ' ');
                    titleInput.value = filename;
                } catch (err) { console.log("Не удалось вытащить имя"); }
            }
        });
    }

    if(UI.volumeFill) UI.volumeFill.style.width = (settings.volume * 100) + '%';
    if(UI.repeatBtn) UI.repeatBtn.style.color = settings.isRepeat ? 'var(--accent)' : 'var(--text-dim)';
    if(UI.shuffleBtn) UI.shuffleBtn.style.color = settings.isShuffle ? 'var(--accent)' : 'var(--text-dim)';
    
    showToast(`Добро пожаловать, ${userProfile.name}!`);
});

// --- 3. ЛОГИКА ПРОФИЛЯ + ВИДЕО БАННЕР ---

function applyProfileStyles() {
    const root = document.documentElement;
    root.setAttribute('data-theme', userProfile.theme);
    
    if (userProfile.theme === 'default' && userProfile.color) {
        root.style.setProperty('--accent', userProfile.color);
    } else {
        root.style.removeProperty('--accent');
    }

    const nameDisplay = document.getElementById('current-user-name');
    if (nameDisplay) nameDisplay.innerText = userProfile.name;

    const avatarEl = document.getElementById('current-user-avatar');
    if (avatarEl) {
        if (userProfile.avatar) {
            avatarEl.style.backgroundImage = `url(${userProfile.avatar})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundColor = 'transparent';
        } else {
            avatarEl.style.backgroundImage = 'none';
            avatarEl.style.backgroundColor = userProfile.color;
        }
    }

    handleBannerMedia();
}

/**
 * Функция управления медиа-баннером (Видео или Фото)
 */
function handleBannerMedia() {
    if (!UI.contentArea) return;

    // Ищем существующее видео
    let videoBg = document.getElementById('banner-video');
    
    if (userProfile.banner) {
        // Проверяем, является ли баннер видео (Base64 видео или ссылка на mp4/webm)
        const isVideo = userProfile.banner.includes("video/mp4") || 
                        userProfile.banner.includes("video/webm") || 
                        userProfile.banner.match(/\.(mp4|webm|mov)$/i);

        if (isVideo) {
            // Если видео еще нет — создаем
            if (!videoBg) {
                videoBg = document.createElement('video');
                videoBg.id = 'banner-video';
                videoBg.autoplay = true;
                videoBg.muted = true;
                videoBg.loop = true;
                videoBg.playsInline = true;
                UI.contentArea.appendChild(videoBg);
            }
            videoBg.src = userProfile.banner;
            UI.contentArea.style.backgroundImage = "none";
        } else {
            // Если это картинка — удаляем видео и ставим фон
            if (videoBg) videoBg.remove();
            UI.contentArea.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.3), var(--bg-dark)), url(${userProfile.banner})`;
            UI.contentArea.style.backgroundSize = 'cover';
            UI.contentArea.style.backgroundPosition = 'center top';
        }
    } else {
        // Если баннера нет — всё чистим
        if (videoBg) videoBg.remove();
        UI.contentArea.style.backgroundImage = `linear-gradient(to bottom, #222, var(--bg-dark))`;
    }
}

document.getElementById('open-profile-btn').onclick = () => {
    document.getElementById('edit-name').value = userProfile.name;
    document.getElementById('edit-theme').value = userProfile.theme;
    if(document.getElementById('edit-color')) document.getElementById('edit-color').value = userProfile.color;
    UI.profileModal.style.display = 'flex';
};

document.getElementById('save-profile').onclick = async () => {
    const saveBtn = document.getElementById('save-profile');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Обработка...";
    
    userProfile.name = document.getElementById('edit-name').value || "User";
    userProfile.theme = document.getElementById('edit-theme').value;
    if(document.getElementById('edit-color')) userProfile.color = document.getElementById('edit-color').value;

    const avInput = document.getElementById('upload-avatar');
    const bnInput = document.getElementById('upload-banner');

    try {
        if (avInput.files[0]) userProfile.avatar = await fileToBase64(avInput.files[0]);
        if (bnInput.files[0]) userProfile.banner = await fileToBase64(bnInput.files[0]);
        
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));
        applyProfileStyles();
        updateOnlineStatus();

        UI.profileModal.style.display = 'none';
        showToast("Профиль сохранен!");
    } catch (e) {
        showToast("Файл слишком велик!", "error");
    } finally {
        saveBtn.innerText = originalText;
    }
};

document.getElementById('close-profile').onclick = () => UI.profileModal.style.display = 'none';

// --- 4. ЛОГИКА БИБЛИОТЕКИ (FIREBASE) ---

const addByLinkBtn = document.getElementById('add-by-link-btn');
if (addByLinkBtn) {
    addByLinkBtn.onclick = () => {
        UI.uploadModal.style.display = 'flex';
        document.getElementById('custom-title').value = "";
        document.getElementById('custom-artist').value = userProfile.name;
        document.getElementById('custom-url').value = "";
    };
}

UI.fileInput.addEventListener('change', (e) => {
    pendingFile = e.target.files[0];
    if (pendingFile) {
        UI.uploadModal.style.display = 'flex';
        document.getElementById('custom-title').value = pendingFile.name.replace('.mp3', '');
        document.getElementById('custom-artist').value = userProfile.name;
        showToast("Файл выбран. Вставь ссылку для облака.");
    }
});

document.getElementById('confirm-upload').onclick = async () => {
    const btn = document.getElementById('confirm-upload');
    let songUrl = document.getElementById('custom-url').value; 
    const coverUrl = document.getElementById('custom-cover-link').value;
    
    // DROPBOX FIX
    if (songUrl.includes("dropbox.com")) {
        songUrl = songUrl.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("dl=0", "raw=1");
    }
    
    if (!songUrl || !songUrl.startsWith('http')) {
        showToast("Нужна прямая ссылка!", "error");
        return;
    }

    btn.innerText = "Публикация...";
    try {
        const newSong = {
            title: document.getElementById('custom-title').value || "Без названия",
            artist: document.getElementById('custom-artist').value || "Неизвестен",
            cover: coverUrl || "https://via.placeholder.com/300/1db954/ffffff?text=Music", 
            url: songUrl,
            addedBy: userProfile.name
        };

        const newSongRef = push(globalSongsRef);
        await set(newSongRef, newSong);

        UI.uploadModal.style.display = 'none';
        UI.fileInput.value = '';
        showToast("Добавлено в общую очередь!");
    } catch (e) {
        showToast("Ошибка базы данных", "error");
    } finally {
        btn.innerText = "Опубликовать";
    }
};

document.getElementById('cancel-upload').onclick = () => UI.uploadModal.style.display = 'none';

async function deleteSong(index, event) {
    event.stopPropagation();
    if(confirm("Удалить этот трек для всех?")) {
        const keyToDelete = songKeys[index];
        try {
            await remove(ref(db, `shared_songs/${keyToDelete}`));
            showToast("Трек удален");
        } catch (e) {
            showToast("Нет прав доступа", "error");
        }
    }
}

function renderLibrary() {
    if (songs.length === 0) {
        UI.songGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-dim)">Музыки пока нет. Будь первым!</div>`;
        return;
    }
    UI.songGrid.innerHTML = songs.map((song, i) => `
        <div class="song-card ${currentSongIndex === i ? 'playing-card' : ''}" onclick="playSong(${i})">
            <button class="delete-btn" onclick="deleteSong(${i}, event)"><i class="fas fa-trash"></i></button>
            <div class="cover">
                <img src="${song.cover}" loading="lazy">
                <div class="play-btn"><i class="fas ${currentSongIndex === i && isPlaying ? 'fa-pause' : 'fa-play'}"></i></div>
            </div>
            <div class="info"><span class="title">${song.title}</span><span class="artist">${song.artist}</span></div>
        </div>`).join('');
}

// --- 5. ПЛЕЕР (LOGIC) ---

function playSong(index) {
    if (index < 0 || index >= songs.length) return;
    if (currentSongIndex === index) { togglePlay(); return; }
    
    currentSongIndex = index;
    audio.src = songs[index].url;
    audio.play().then(() => { 
        isPlaying = true; 
        updatePlayerUI(songs[index]); 
    }).catch(() => {
        showToast("Ошибка воспроизведения ссылки", "error");
    });
}

function togglePlay() {
    if (!audio.src) return;
    isPlaying ? audio.pause() : audio.play();
    isPlaying = !isPlaying;
    updatePlayBtn();
    renderLibrary();
}

function updatePlayerUI(song) {
    UI.displayName.innerText = song.title;
    UI.displayArtist.innerText = song.artist;
    UI.currentCover.innerHTML = `<img src="${song.cover}">`;
    updatePlayBtn();
    renderLibrary();
}

function updatePlayBtn() {
    UI.playPauseBtn.innerHTML = `<i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>`;
}

function initPlayerControls() {
    UI.playPauseBtn.onclick = togglePlay;
    UI.nextBtn.onclick = () => {
        if (songs.length === 0) return;
        let next = settings.isShuffle ? Math.floor(Math.random() * songs.length) : (currentSongIndex + 1) % songs.length;
        playSong(next);
    };
    UI.prevBtn.onclick = () => {
        if (songs.length === 0) return;
        let prev = (currentSongIndex - 1 < 0) ? songs.length - 1 : currentSongIndex - 1;
        playSong(prev);
    };

    if(UI.shuffleBtn) UI.shuffleBtn.onclick = () => {
        settings.isShuffle = !settings.isShuffle;
        UI.shuffleBtn.style.color = settings.isShuffle ? 'var(--accent)' : 'var(--text-dim)';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    };

    if(UI.repeatBtn) UI.repeatBtn.onclick = () => {
        settings.isRepeat = !settings.isRepeat;
        UI.repeatBtn.style.color = settings.isRepeat ? 'var(--accent)' : 'var(--text-dim)';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    };

    UI.volumeBg.onclick = (e) => {
        let vol = e.offsetX / UI.volumeBg.clientWidth;
        audio.volume = Math.max(0, Math.min(1, vol));
        UI.volumeFill.style.width = (audio.volume * 100) + '%';
        settings.volume = audio.volume;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    };
}

audio.onended = () => {
    if (settings.isRepeat) { audio.currentTime = 0; audio.play(); } 
    else UI.nextBtn.click();
};

audio.ontimeupdate = () => {
    if (!audio.duration) return;
    UI.progressBar.style.width = (audio.currentTime / audio.duration) * 100 + "%";
    document.getElementById('current-time').innerText = formatTime(audio.currentTime);
    document.getElementById('total-duration').innerText = formatTime(audio.duration);
};

UI.progressContainer.onclick = (e) => {
    if (!audio.duration) return;
    audio.currentTime = (e.offsetX / UI.progressContainer.clientWidth) * audio.duration;
};

// --- 6. FIREBASE ONLINE ---

function initRealtimeFriends() {
    const myPresenceRef = ref(db, `online/${userId}`);
    onValue(ref(db, '.info/connected'), (snap) => {
        if (snap.val() === true) {
            onDisconnect(myPresenceRef).remove();
            updateOnlineStatus();
        }
    });

    onValue(ref(db, 'online'), (snapshot) => {
        renderOnlineUsers(snapshot.val());
    });
}

function updateOnlineStatus() {
    set(ref(db, `online/${userId}`), {
        name: userProfile.name,
        avatar: userProfile.avatar,
        color: userProfile.color,
        lastSeen: Date.now()
    });
}

function renderOnlineUsers(users) {
    if (!users) return;
    const userList = Object.values(users);
    if(UI.onlineCounter) UI.onlineCounter.innerText = `${userList.length} онлайн`;

    UI.friendAvatars.innerHTML = userList.map(user => `
        <div class="avatar" title="${user.name}" style="
            background: ${user.avatar ? `url(${user.avatar})` : user.color};
            background-size: cover; background-position: center;">
        </div>
    `).join('');
}

// --- 7. УТИЛИТЫ ---

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function showToast(message, type = 'success') {
    let toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = `position:fixed; bottom:110px; left:50%; transform:translateX(-50%); background:${type === 'error' ? '#ff4757' : 'var(--accent)'}; color:#000; padding:10px 20px; border-radius:20px; font-weight:bold; z-index:10000; transition:0.3s; pointer-events:none;`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Экспорт функций для HTML onclick
window.playSong = playSong;
window.togglePlay = togglePlay;
window.deleteSong = deleteSong;
