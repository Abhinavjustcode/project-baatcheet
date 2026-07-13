const RoomManager = require('./RoomManager');

class UserManager {
    constructor() {
        this.users = new Map();
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(name, socket) {
        this.users.set(socket.id, { name, socket, currentRoomId: null });
        this.moveUserToQueue(socket.id);
        this.initHandlers(socket);
    }

    moveUserToQueue(socketId) {
        const user = this.users.get(socketId);
        if (!user) return;
        
        user.currentRoomId = null;
        this.queue.push(socketId);
        user.socket.emit("lobby"); 
        this.clearQueue();
    }

    removeUser(socketId) {
        const user = this.users.get(socketId);
        if (!user) return;

        if (user.currentRoomId) {
            const partner = this.roomManager.destroyRoom(user.currentRoomId, socketId);
            if (partner) {
                this.moveUserToQueue(partner.socket.id);
            }
        }

        this.users.delete(socketId);
        this.queue = this.queue.filter(id => id !== socketId);
    }

    clearQueue() {
        while (this.queue.length >= 2) {
            const id1 = this.queue.shift();
            const id2 = this.queue.shift();
            
            const user1 = this.users.get(id1);
            const user2 = this.users.get(id2);

            if (!user1 || !user2) continue;

            const roomId = this.roomManager.generateRoomId();
            user1.currentRoomId = roomId;
            user2.currentRoomId = roomId;

            this.roomManager.createRoom(user1, user2);
        }
    }

    initHandlers(socket) {
        socket.on("offer", ({ sdp, roomId }) => {
            this.roomManager.onOffer(roomId, sdp, socket.id);
        });

        socket.on("answer", ({ sdp, roomId }) => {
            this.roomManager.onAnswer(roomId, sdp, socket.id);
        });

        socket.on("add-ice-candidate", ({ candidate, roomId }) => {
            this.roomManager.onIceCandidate(roomId, socket.id, candidate);
        });
    }
}

module.exports = UserManager;