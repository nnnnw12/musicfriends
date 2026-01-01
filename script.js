/**
 * MusicFriends Engine Ultimate + REAL-TIME ONLINE SYSTEM
 */

// --- 0. ПОДКЛЮЧЕНИЕ FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, push } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

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

// --- 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ ---

const STORAGE_KEYS = {
    LIBRARY: 'mf_library_v4',
    PROFILE: 'mf_profile_v4',
    SETTINGS: 'mf_settings_v4'
};

let songs = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIBRARY)) || [];
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

// Функция сохранения библиотеки (исправлена)
function saveLibrary() {
    try {
        localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(songs));
    } catch (e) {
        showToast("Ошибка: память браузера переполнена", "error");
    }
}
window.saveLibrary = saveLibrary;

let currentSongIndex = -1;
let isPlaying = false;
let pendingFile = null;
const audio = new Audio();
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
    friendAvatars: document.getElementById('friend-avatars')
};

// --- 2. ИНИЦИАЛИЗАЦИЯ ---

window.addEventListener('DOMContentLoaded', () => {
    applyProfileStyles();
    renderLibrary();
    initPlayerControls();
    initRealtimeFriends();

    if(UI.volumeFill) UI.volumeFill.style.width = (settings.volume * 100) + '%';
    
    // Подсветка кнопок повтора/шаффла при загрузке
    if(UI.repeatBtn) UI.repeatBtn.style.color = settings.isRepeat ? 'var(--accent)' : 'var(--text-dim)';
    if(UI.shuffleBtn) UI.shuffleBtn.style.color = settings.isShuffle ? 'var(--accent)' : 'var(--text-dim)';
    
    showToast(`Добро пожаловать, ${userProfile.name}!`);
});

// --- 3. ЛОГИКА ПРОФИЛЯ ---

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

    const contentEl = document.querySelector('.content');
    if (contentEl) {
        if (userProfile.banner) {
            contentEl.style.backgroundImage = `linear-gradient(to bottom, rgba(18,18,18,0.8), #121212), url(${userProfile.banner})`;
            contentEl.style.backgroundSize = 'cover';
            contentEl.style.backgroundPosition = 'center top';
        } else {
            contentEl.style.backgroundImage = `linear-gradient(to bottom, #222, #121212)`;
        }
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
    saveBtn.innerText = "Сохранение...";
    
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
        showToast("Профиль обновлен!");
    } catch (e) {
        showToast("Ошибка: Картинка слишком большая!", "error");
    } finally {
        saveBtn.innerText = "Сохранить";
    }
};

document.getElementById('close-profile').onclick = () => UI.profileModal.style.display = 'none';

// --- 4. ЛОГИКА БИБЛИОТЕКИ ---

UI.fileInput.addEventListener('change', (e) => {
    pendingFile = e.target.files[0];
    if (pendingFile) {
        UI.uploadModal.style.display = 'flex';
        document.getElementById('custom-title').value = pendingFile.name.replace('.mp3', '');
        document.getElementById('custom-artist').value = userProfile.name;
    }
});

// ИЗМЕНЕННАЯ ФУНКЦИЯ ДЛЯ ДИСКОРД-ССЫЛОК
document.getElementById('confirm-upload').onclick = async () => {
    const btn = document.getElementById('confirm-upload');
    const discordUrl = document.getElementById('custom-cover').value; // Берем ссылку из поля "URL обложки"

    if (!discordUrl || !discordUrl.startsWith('http')) {
        showToast("Вставь ссылку на MP3 в поле 'URL обложки'!", "error");
        return;
    }

    btn.innerText = "Загрузка...";
    try {
        const newSong = {
            id: Date.now(),
            title: document.getElementById('custom-title').value || "Без названия",
            artist: document.getElementById('custom-artist').value || "Неизвестен",
            cover: "https://via.placeholder.com/300/1db954/ffffff?text=Music", 
            url: discordUrl // Прямая ссылка на файл вместо Base64
        };
        songs.push(newSong);
        saveLibrary();
        renderLibrary();
        UI.uploadModal.style.display = 'none';
        UI.fileInput.value = '';
        showToast("Трек успешно добавлен по ссылке!");
    } catch (e) {
        showToast("Ошибка сохранения", "error");
    } finally {
        btn.innerText = "Опубликовать";
    }
};

document.getElementById('cancel-upload').onclick = () => UI.uploadModal.style.display = 'none';

function deleteSong(index, event) {
    event.stopPropagation();
    if(confirm("Удалить этот трек?")) {
        songs.splice(index, 1);
        saveLibrary();
        renderLibrary();
        if (index === currentSongIndex) {
            audio.pause();
            isPlaying = false;
            updatePlayBtn();
        } else if (index < currentSongIndex) {
            currentSongIndex--;
        }
        showToast("Трек удален");
    }
}

function renderLibrary() {
    if (songs.length === 0) {
        UI.songGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-dim)">Библиотека пуста.</div>`;
        return;
    }
    UI.songGrid.innerHTML = songs.map((song, i) => `
        <div class="song-card ${currentSongIndex === i ? 'playing-card' : ''}" onclick="playSong(${i})">
            <button class="delete-btn" onclick="deleteSong(${i}, event)"><i class="fas fa-trash"></i></button>
            <div class="cover">
                <img src="${song.cover}" style="width:100%; height:100%; object-fit:cover;">
                <div class="play-btn"><i class="fas ${currentSongIndex === i && isPlaying ? 'fa-pause' : 'fa-play'}"></i></div>
            </div>
            <div class="info"><span class="title">${song.title}</span><span class="artist">${song.artist}</span></div>
        </div>`).join('');
}

// --- 5. ПЛЕЕР ---

function playSong(index) {
    if (index < 0 || index >= songs.length) return;
    if (currentSongIndex === index) { togglePlay(); return; }
    currentSongIndex = index;
    audio.src = songs[index].url;
    audio.play().then(() => { 
        isPlaying = true; 
        updatePlayerUI(songs[index]); 
    }).catch(() => showToast("Ошибка воспроизведения ссылки", "error"));
}

function togglePlay() {
    if (!audio.src) return;
    isPlaying ? audio.pause() : audio.play();
    isPlaying = !isPlaying;
    updatePlayBtn();
    renderLibrary();
}

// Экспорт функций в глобальное окно (обязательно для модулей)
window.playSong = playSong;
window.togglePlay = togglePlay;
window.deleteSong = deleteSong;

function updatePlayerUI(song) {
    UI.displayName.innerText = song.title;
    UI.displayArtist.innerText = song.artist;
    UI.currentCover.innerHTML = `<img src="${song.cover}" style="width:100%; height:100%; object-fit:cover;">`;
    updatePlayBtn();
    renderLibrary();
}

function updatePlayBtn() {
    UI.playPauseBtn.innerHTML = `<i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>`;
}

function initPlayerControls() {
    UI.playPauseBtn.onclick = togglePlay;
    UI.nextBtn.onclick = () => {
        if (settings.isShuffle) playSong(Math.floor(Math.random() * songs.length));
        else playSong((currentSongIndex + 1) % songs.length);
    };
    UI.prevBtn.onclick = () => {
        let prev = currentSongIndex - 1;
        if (prev < 0) prev = songs.length - 1;
        playSong(prev);
    };

    if(UI.shuffleBtn) UI.shuffleBtn.onclick = () => {
        settings.isShuffle = !settings.isShuffle;
        UI.shuffleBtn.style.color = settings.isShuffle ? 'var(--accent)' : 'var(--text-dim)';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        showToast(settings.isShuffle ? "Перемешивание: ВКЛ" : "Перемешивание: ВЫКЛ");
    };

    if(UI.repeatBtn) UI.repeatBtn.onclick = () => {
        settings.isRepeat = !settings.isRepeat;
        UI.repeatBtn.style.color = settings.isRepeat ? 'var(--accent)' : 'var(--text-dim)';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        showToast(settings.isRepeat ? "Повтор: ВКЛ" : "Повтор: ВЫКЛ");
    };

    UI.volumeBg.onclick = (e) => {
        let vol = e.offsetX / UI.volumeBg.clientWidth;
        audio.volume = Math.max(0, Math.min(1, vol));
        settings.volume = audio.volume;
        UI.volumeFill.style.width = (audio.volume * 100) + '%';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    };

    document.addEventListener('keydown', (e) => {
        if(e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); togglePlay(); }
    });
}

// Логика окончания трека (исправлен ПОВТОР)
audio.onended = () => {
    if (settings.isRepeat) {
        audio.currentTime = 0;
        audio.play();
    } else {
        if (settings.isShuffle) {
            playSong(Math.floor(Math.random() * songs.length));
        } else if (currentSongIndex < songs.length - 1) {
            playSong(currentSongIndex + 1);
        } else {
            isPlaying = false;
            updatePlayBtn();
            renderLibrary();
        }
    }
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

let myPresenceRef = null;

function initRealtimeFriends() {
    const onlineRef = ref(db, 'online');
    myPresenceRef = push(onlineRef);

    updateOnlineStatus();
    onDisconnect(myPresenceRef).remove();

    onValue(onlineRef, (snapshot) => {
        const users = snapshot.val();
        renderOnlineUsers(users);
    });
}

function updateOnlineStatus() {
    if (myPresenceRef) {
        set(myPresenceRef, {
            name: userProfile.name,
            avatar: userProfile.avatar,
            color: userProfile.color,
            lastSeen: Date.now()
        });
    }
}

function renderOnlineUsers(users) {
    if (!users) {
        UI.onlineCounter.innerText = "0 онлайн";
        UI.friendAvatars.innerHTML = "";
        return;
    }
    const userList = Object.values(users);
    UI.onlineCounter.innerText = `${userList.length} онлайн`;

    UI.friendAvatars.innerHTML = userList.map(user => `
        <div class="avatar" title="${user.name}" style="
            background: ${user.avatar ? `url(${user.avatar})` : user.color};
            background-size: cover;
            background-position: center;
            border: 2px solid #121212;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: inline-block;
            margin-right: -10px;
            position: relative;
        "></div>
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
    toast.style.cssText = `position:fixed; bottom:110px; left:50%; transform:translateX(-50%); background:${type === 'error' ? '#ff4757' : 'var(--accent, #1db954)'}; color:#000; padding:10px 20px; border-radius:20px; font-weight:bold; z-index:10000; transition:0.3s; pointer-events:none;`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}
