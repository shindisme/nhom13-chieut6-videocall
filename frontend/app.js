const { Room, RoomEvent, Track } = LivekitClient;

// Cấu hình
const BACKEND_URL = 'http://localhost:3000';

// Elements
const joinForm = document.getElementById('join-form');
const callSection = document.getElementById('call-section');
const roomNameInput = document.getElementById('room-name');
const userNameInput = document.getElementById('user-name');
const joinBtn = document.getElementById('join-btn');
const roomTitle = document.getElementById('room-title');
const participantCount = document.getElementById('participant-count');
const videoGrid = document.getElementById('video-grid');
const toggleMicBtn = document.getElementById('toggle-mic');
const toggleCameraBtn = document.getElementById('toggle-camera');
const toggleScreenBtn = document.getElementById('toggle-screen');
const leaveBtn = document.getElementById('leave-btn');

// State
let currentRoom = null;
let isMicEnabled = true;
let isCameraEnabled = true;
let isScreenSharing = false;

// === Hàm lấy token từ backend ===
async function getToken(roomName, participantName) {
    const response = await fetch(`${BACKEND_URL}/get-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
    });

    if (!response.ok) {
        throw new Error('Không thể lấy token');
    }

    return response.json();
}

// === Tham gia phòng ===
async function joinRoom() {
    const roomName = roomNameInput.value.trim();
    const userName = userNameInput.value.trim();

    if (!roomName || !userName) {
        alert('Vui lòng nhập tên phòng và tên của bạn!');
        return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = '⏳ Đang kết nối...';

    try {
        // Lấy token
        const { token, url } = await getToken(roomName, userName);

        // Tạo room instance
        currentRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
        });

        // Đăng ký các event handlers
        setupRoomEvents();

        // Kết nối với LiveKit
        await currentRoom.connect(url, token);

        console.log('✅ Đã kết nối với phòng:', roomName);

        // Bật camera và mic
        await currentRoom.localParticipant.enableCameraAndMicrophone();

        // Hiển thị giao diện call
        showCallUI(roomName);

    } catch (error) {
        console.error('❌ Lỗi kết nối:', error);
        alert('Không thể kết nối. Hãy đảm bảo backend đang chạy!\n\nLỗi: ' + error.message);
        joinBtn.disabled = false;
        joinBtn.textContent = '🚀 Tham gia phòng';
    }
}

// === Setup Room Events ===
function setupRoomEvents() {
    // Khi có track mới được publish
    currentRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('📺 Track subscribed:', track.kind, 'from', participant.identity);
        attachTrack(track, participant);
    });

    // Khi track bị unsubscribe
    currentRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log('📺 Track unsubscribed:', track.kind);
        detachTrack(track, participant);
    });

    // Khi local track được publish
    currentRoom.on(RoomEvent.LocalTrackPublished, (publication) => {
        const track = publication.track;
        if (track) {
            attachLocalTrack(track);
        }
    });

    // Khi có người tham gia
    currentRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Người mới tham gia:', participant.identity);
        updateParticipantCount();
    });

    // Khi có người rời đi
    currentRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('👤 Người rời phòng:', participant.identity);
        removeParticipantVideo(participant.identity);
        updateParticipantCount();
    });

    // Khi bị ngắt kết nối
    currentRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('❌ Ngắt kết nối:', reason);
        leaveRoom();
    });
}

// === Attach track vào UI ===
function attachTrack(track, participant) {
    let container = document.getElementById(`video-${participant.identity}`);

    if (!container) {
        container = createVideoContainer(participant.identity, false);
    }

    if (track.kind === Track.Kind.Video) {
        const videoElement = track.attach();
        videoElement.id = `video-element-${participant.identity}`;

        // Xóa placeholder nếu có
        const placeholder = container.querySelector('.no-video-placeholder');
        if (placeholder) placeholder.remove();

        container.insertBefore(videoElement, container.firstChild);
    } else if (track.kind === Track.Kind.Audio) {
        const audioElement = track.attach();
        container.appendChild(audioElement);
    }
}

function attachLocalTrack(track) {
    const localIdentity = currentRoom.localParticipant.identity;
    let container = document.getElementById(`video-${localIdentity}`);

    if (!container) {
        container = createVideoContainer(localIdentity, true);
    }

    if (track.kind === Track.Kind.Video) {
        const existingVideo = container.querySelector('video');
        if (existingVideo) existingVideo.remove();

        const placeholder = container.querySelector('.no-video-placeholder');
        if (placeholder) placeholder.remove();

        const videoElement = track.attach();
        videoElement.id = `local-video`;
        container.insertBefore(videoElement, container.firstChild);
    }
}

function detachTrack(track, participant) {
    track.detach().forEach((element) => element.remove());
}

// === Tạo video container ===
function createVideoContainer(identity, isLocal) {
    const container = document.createElement('div');
    container.id = `video-${identity}`;
    container.className = `video-container ${isLocal ? 'local' : ''}`;

    const placeholder = document.createElement('div');
    placeholder.className = 'no-video-placeholder';
    placeholder.textContent = '👤';

    const nameTag = document.createElement('div');
    nameTag.className = 'participant-name';
    nameTag.textContent = isLocal ? `${identity} (Bạn)` : identity;

    container.appendChild(placeholder);
    container.appendChild(nameTag);
    videoGrid.appendChild(container);

    return container;
}

function removeParticipantVideo(identity) {
    const container = document.getElementById(`video-${identity}`);
    if (container) container.remove();
}

// === Hiển thị giao diện call ===
function showCallUI(roomName) {
    joinForm.classList.add('hidden');
    callSection.classList.remove('hidden');
    roomTitle.textContent = `Phòng: ${roomName}`;
    updateParticipantCount();
}

function updateParticipantCount() {
    if (currentRoom) {
        const count = currentRoom.numParticipants + 1; // +1 cho local participant
        participantCount.textContent = `${count} người tham gia`;
    }
}

// === Điều khiển ===
async function toggleMic() {
    if (!currentRoom) return;

    isMicEnabled = !isMicEnabled;
    await currentRoom.localParticipant.setMicrophoneEnabled(isMicEnabled);

    toggleMicBtn.textContent = isMicEnabled ? '🎤 Mic' : '🔇 Mic tắt';
    toggleMicBtn.classList.toggle('muted', !isMicEnabled);
}

async function toggleCamera() {
    if (!currentRoom) return;

    isCameraEnabled = !isCameraEnabled;
    await currentRoom.localParticipant.setCameraEnabled(isCameraEnabled);

    toggleCameraBtn.textContent = isCameraEnabled ? '📷 Camera' : '📷 Camera tắt';
    toggleCameraBtn.classList.toggle('muted', !isCameraEnabled);
}

async function toggleScreenShare() {
    if (!currentRoom) return;

    try {
        isScreenSharing = !isScreenSharing;
        await currentRoom.localParticipant.setScreenShareEnabled(isScreenSharing);

        toggleScreenBtn.textContent = isScreenSharing ? '🖥️ Dừng chia sẻ' : '🖥️ Chia sẻ màn hình';
        toggleScreenBtn.classList.toggle('active', isScreenSharing);
    } catch (error) {
        console.error('Lỗi chia sẻ màn hình:', error);
        isScreenSharing = false;
    }
}

async function leaveRoom() {
    if (currentRoom) {
        await currentRoom.disconnect();
        currentRoom = null;
    }

    // Reset UI
    callSection.classList.add('hidden');
    joinForm.classList.remove('hidden');
    videoGrid.innerHTML = '';
    joinBtn.disabled = false;
    joinBtn.textContent = '🚀 Tham gia phòng';

    // Reset states
    isMicEnabled = true;
    isCameraEnabled = true;
    isScreenSharing = false;
    toggleMicBtn.textContent = '🎤 Mic';
    toggleMicBtn.classList.remove('muted');
    toggleCameraBtn.textContent = '📷 Camera';
    toggleCameraBtn.classList.remove('muted');
    toggleScreenBtn.textContent = '🖥️ Chia sẻ màn hình';
    toggleScreenBtn.classList.remove('active');
}

// === Event Listeners ===
joinBtn.addEventListener('click', joinRoom);
toggleMicBtn.addEventListener('click', toggleMic);
toggleCameraBtn.addEventListener('click', toggleCamera);
toggleScreenBtn.addEventListener('click', toggleScreenShare);
leaveBtn.addEventListener('click', leaveRoom);

// Cho phép Enter để join
userNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinRoom();
});

console.log('🎥 LiveKit Video Call App - Nhóm 13 đã sẵn sàng!');
