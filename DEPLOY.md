# Deployment

## Railway backend
Root directory: backend
Start: npm start
Set CLIENT_ORIGIN to the Vercel URL.

## Vercel frontend
Root directory: frontend
Build: npm run build
Output: dist
Set VITE_SIGNALING_URL to the Railway WebSocket URL (wss://...).

Use TURN in production for reliable WebRTC connectivity behind restrictive NAT/firewalls.
