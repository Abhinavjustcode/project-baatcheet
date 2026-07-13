const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // CORS ko require kiya
const UserManager = require('./UserManager');

const app = express();
app.use(cors()); // Express server ko sabhi connections allow karne ka permission diya

const server = http.createServer(app);

// Allow the frontend to connect
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const userManager = new UserManager();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  userManager.addUser("randomName", socket);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    userManager.removeUser(socket.id);
  });
});

server.listen(3000, () => {
  console.log('Signaling server running on port 3000');
});