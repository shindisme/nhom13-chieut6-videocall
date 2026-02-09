require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// API tạo token để join room
app.post('/get-token', async (req, res) => {
  const { roomName, participantName } = req.body;

  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'Cần có roomName và participantName' });
  }

  try {
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
        ttl: '1h',
      }
    );

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    
    res.json({
      token: jwt,
      url: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error('Lỗi tạo token:', error);
    res.status(500).json({ error: 'Không thể tạo token' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`LiveKit URL: ${process.env.LIVEKIT_URL}`);
});
