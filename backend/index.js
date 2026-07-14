const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let queue = [];

io.on('connection', (socket) => {
    socket.on('request-room', () => {
        if (queue.length > 0) {
            let peer = queue.pop();
            let roomId = socket.id + "#" + peer.id;
            socket.join(roomId);
            peer.join(roomId);
            socket.emit('room-created', { roomId, offer: true });
            peer.emit('room-created', { roomId, offer: false });
        } else {
            queue.push(socket);
        }
    });

    socket.on('offer', (data) => socket.to(data.roomId).emit('offer', data));
    socket.on('answer', (data) => socket.to(data.roomId).emit('answer', data));
    socket.on('ice-candidate', (data) => socket.to(data.roomId).emit('ice-candidate', data.candidate));
    socket.on('meme', (data) => socket.to(data.roomId).emit('meme', data));
    socket.on('chat', (data) => socket.to(data.roomId).emit('chat', data.message));
    socket.on('skip', (roomId) => socket.to(roomId).emit('skip'));
    
    socket.on('disconnect', () => { queue = queue.filter(s => s.id !== socket.id); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server Active on ${PORT}`));