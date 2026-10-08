import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';

const app = express();
app.use(cors());
app.get('/health', (_req,res)=>res.json({ok:true,service:'baatcheet-signaling',time:Date.now()}));
const server = http.createServer(app);
const wss = new WebSocketServer({server});
const clients = new Map();
const queue = [];
const rooms = new Map();
const roomWaiters = new Map();

const id = () => crypto.randomBytes(6).toString('base64url');
const send = (c, msg) => { if (c?.ws?.readyState === 1) c.ws.send(JSON.stringify(msg)); };
const removeFrom = (arr, value) => { const i=arr.indexOf(value); if(i>=0) arr.splice(i,1); };
function cleanQueue(client){ removeFrom(queue, client.id); }
function makeRoom(){ let r; do r=Math.random().toString(36).slice(2,8).toUpperCase(); while(rooms.has(r)); return r; }
function partnerOf(c){ return c?.partnerId ? clients.get(c.partnerId) : null; }
function clearPair(c, notify=true){
  const p=partnerOf(c);
  if(p) { p.partnerId=null; p.roomId=null; p.callReady=false; if(notify) send(p,{type:'peer-left'}); }
  c.partnerId=null; c.roomId=null; c.callReady=false;
}
function pair(a,b, context='random'){
  cleanQueue(a); cleanQueue(b);
  a.partnerId=b.id; b.partnerId=a.id; a.roomId=null; b.roomId=null;
  a.callReady=false; b.callReady=false;
  a.history.unshift(b.id); b.history.unshift(a.id);
  a.history=a.history.slice(0,20); b.history=b.history.slice(0,20);
  send(a,{type:'matched',peerId:b.id,initiator:a.id < b.id,context});
  send(b,{type:'matched',peerId:a.id,initiator:b.id < a.id,context});
}
function tryMatch(){
  while(queue.length>=2){
    const a=clients.get(queue.shift()), b=clients.get(queue.shift());
    if(!a||!b||a.partnerId||b.partnerId) continue;
    pair(a,b,'random');
  }
}
function queueClient(c){
  if(!c || c.partnerId || queue.includes(c.id)) return;
  c.mode='random'; queue.push(c.id); send(c,{type:'waiting',position:queue.length}); tryMatch();
}
function createRoom(c){
  cleanQueue(c); clearPair(c,false);
  const room=makeRoom(); rooms.set(room,{hostId:c.id}); roomWaiters.set(room,c.id); c.roomId=room;
  send(c,{type:'room-created',roomId:room,linkRoom:room});
}
function joinRoom(c, room){
  room=(room||'').trim().toUpperCase();
  cleanQueue(c); clearPair(c,false);
  const hostId=roomWaiters.get(room);
  if(!hostId){ send(c,{type:'room-error',message:'That room is waiting for its host or has expired.'}); return; }
  const host=clients.get(hostId);
  if(!host){ roomWaiters.delete(room); rooms.delete(room); send(c,{type:'room-error',message:'Host is no longer online.'}); return; }
  roomWaiters.delete(room); rooms.delete(room);
  host.roomId=null; c.roomId=null;
  pair(host,c,'friend');
}
function next(c){
  const p=partnerOf(c);
  if(p){ clearPair(c,true); queueClient(p); }
  cleanQueue(c); queueClient(c); tryMatch();
}
function back(c){
  const previousId=c.history.find(x=>{const p=clients.get(x); return p && !p.partnerId && p.id!==c.id;});
  if(!previousId){ send(c,{type:'back-unavailable'}); return; }
  const p=clients.get(previousId);
  cleanQueue(c); clearPair(c,false); cleanQueue(p); clearPair(p,false); pair(c,p,'back');
}
function handleMessage(c,m){
  switch(m.type){
    case 'queue': queueClient(c); break;
    case 'create-room': createRoom(c); break;
    case 'join-room': joinRoom(c,m.room); break;
    case 'skip': next(c); break;
    case 'back': back(c); break;
    case 'call-ready': {
      const p=partnerOf(c); if(!p) break; c.callReady=true;
      if(p.callReady){ const ts=Date.now(); c.callStartedAt=ts; p.callStartedAt=ts; send(c,{type:'call-start',startedAt:ts}); send(p,{type:'call-start',startedAt:ts}); }
      break;
    }
    case 'signal': { const p=partnerOf(c); if(p) send(p,{type:'signal',data:m.data}); break; }
    case 'chat': { const p=partnerOf(c); if(p) send(p,{type:'chat',text:String(m.text||'').slice(0,500),at:Date.now()}); break; }
    case 'report': { const p=partnerOf(c); if(p) send(p,{type:'peer-reported'}); break; }
    case 'ping': send(c,{type:'pong',t:m.t}); break;
  }
}
wss.on('connection',(ws)=>{
  const c={id:id(),ws,partnerId:null,roomId:null,history:[],callReady:false}; clients.set(c.id,c);
  send(c,{type:'hello',clientId:c.id});
  ws.on('message',(raw)=>{try{handleMessage(c,JSON.parse(raw.toString()));}catch{}});
  ws.on('close',()=>{
    cleanQueue(c);
    const p=partnerOf(c); if(p){p.partnerId=null;p.callReady=false;send(p,{type:'peer-left'});queueClient(p);}
    if(c.roomId && roomWaiters.get(c.roomId)===c.id){roomWaiters.delete(c.roomId);rooms.delete(c.roomId);}
    clients.delete(c.id);
  });
  ws.on('error',()=>{});
});
setInterval(()=>{ for(const c of clients.values()) if(c.ws.readyState===1) c.ws.ping(); },25000);
const PORT=Number(process.env.PORT||8787);
server.listen(PORT,()=>console.log(`Baatcheet signaling listening on ${PORT}`));