class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(user1, user2) {
        const roomId = this.generateRoomId();
        this.rooms.set(roomId, { user1, user2 });
        user1.socket.emit("send-offer", { roomId });
    }

    destroyRoom(roomId, leavingSocketId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;

        const remainingUser = room.user1.socket.id === leavingSocketId ? room.user2 : room.user1;
        this.rooms.delete(roomId); 
        return remainingUser; 
    }

    onOffer(roomId, sdp, senderSocketId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        receivingUser.socket.emit("offer", { sdp, roomId });
    }
    
    onAnswer(roomId, sdp, senderSocketId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        receivingUser.socket.emit("answer", { sdp, roomId });
    }

    onIceCandidate(roomId, senderSocketId, candidate) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        receivingUser.socket.emit("add-ice-candidate", { candidate });
    }

    generateRoomId() {
        return Math.random().toString(36).substring(7);
    }
}

module.exports = RoomManager;