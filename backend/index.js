const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
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

    socket.on('offer', (data) => socket.to(data.roomId).emit('offer', { roomId: data.roomId, sdp: data.sdp }));
    socket.on('answer', (data) => socket.to(data.roomId).emit('answer', { roomId: data.roomId, sdp: data.sdp }));
    socket.on('ice-candidate', (data) => socket.to(data.roomId).emit('ice-candidate', data.candidate));
    socket.on('meme', (data) => socket.to(data.roomId).emit('meme', data));
    socket.on('disconnect', () => { queue = queue.filter(s => s.id !== socket.id); });
});

server.listen(process.env.PORT || 3000);