import { DurableObject } from 'cloudflare:workers';
import { matchCircleRoute } from './circles';

export { WorldCircle } from './circles';

type MapFeature = { id: string; kind: string; name: string; points: number[][] };
type MapPayload = { schema: number; room: string; cellX: number; cellY: number; bounds: ReturnType<typeof cell>; features: MapFeature[]; generatedAt: number; sourceTimestamp: string | null; sourceProvider?: string; attribution: string; attributionURL: string; stale: boolean };
type Growth = { schema: number; abilities: number[]; updatedAt: number };

const R = 6378137, W = 1600, H = 2240;
const ATTRIBUTION = '© OpenStreetMap contributors';
// Sequential, bounded failover stays below the native client's 35s request budget.
const MAP_PROVIDERS = [
  {name:'Private.coffee',url:'https://overpass.private.coffee/api/interpreter',timeout:8000,querySeconds:6},
  {name:'VK Maps',url:'https://maps.mail.ru/osm/tools/overpass/api/interpreter',timeout:24000,querySeconds:20}
];
const MAX_MESSAGE = 4096;
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers});
const finite = (v,min,max) => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
const mercator = (lat,lon) => [R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
const latitude = y => (2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI;
function cell(x,y) {
  if(!Number.isInteger(x)||!Number.isInteger(y)||Math.abs(x)>12524||Math.abs(y)>8946)throw Error('invalid_cell');
  return {x,y,room:`${x}:${y}`,west:x*W-W/2,east:x*W+W/2,north:y*H+H/2,south:y*H-H/2};
}
function counts(v) {
  if(!Array.isArray(v)||v.length!==5||v.some(n=>!Number.isSafeInteger(n)||n<0||n>10000000))throw Error('invalid_abilities');
  return v;
}
async function boundedJSON(request,limit) {
  if(Number(request.headers.get('Content-Length')||0)>limit)throw Error('body_too_large');
  if(!request.body)throw Error('missing_body');
  const reader=request.body.getReader(),chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('body_too_large');chunks.push(value);}}
  finally {await reader.cancel().catch(()=>{});}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(data));
}
async function identity(request, scope = '') {
  const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!token)return null;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope + token));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function point(lat,lon,bounds) {
  const [x,y]=mercator(lat,lon);return [(x-bounds.west)/W*1000,(bounds.north-y)/H*1400];
}
function simplify(points) {
  // Keep endpoints and corners; limit source geometry rather than inventing paths.
  if(points.length<=160)return points;
  const step=Math.ceil(points.length/158);return points.filter((_,i)=>i===0||i===points.length-1||i%step===0);
}
function mapFeatures(data,bounds): MapFeature[] {
  const road=[],building=[],landmark=[];
  for(const e of data.elements||[]) {
    const t=e.tags||{}, name=String(t.name||t['name:en']||'').slice(0,70);
    if(e.type==='way' && Array.isArray(e.geometry) && e.geometry.length>=2) {
      const points=simplify(e.geometry.filter(p=>finite(p.lat,-85,85)&&finite(p.lon,-180,180)).map(p=>point(p.lat,p.lon,bounds)));
      if(points.length<2)continue;
      if(t.highway)road.push({id:`way-${e.id}`,kind:/^(motorway|trunk|primary|secondary|tertiary)$/.test(t.highway)?'majorRoad':'road',name,points});
      else if(t.building||t.amenity||t.historic||t.tourism)building.push({id:`way-${e.id}`,kind:'building',name,points});
    } else if(e.type==='node' && name && finite(e.lat,-85,85) && finite(e.lon,-180,180)) {
      landmark.push({id:`node-${e.id}`,kind:'landmark',name,points:[point(e.lat,e.lon,bounds)]});
    }
  }
  road.sort((a,b)=>Number(b.kind==='majorRoad')-Number(a.kind==='majorRoad'));
  building.sort((a,b)=>Number(Boolean(b.name))-Number(Boolean(a.name)));
  return [...road.slice(0,190),...building.slice(0,45),...landmark.slice(0,14)];
}

/** A geography cell caches one small real-world extract, never a user's exact fix. */
export class MapCell extends DurableObject {
  private inflight: Promise<MapPayload> | null = null;
  async read(x: number,y: number): Promise<MapPayload> {
    const bounds=cell(x,y),old=await this.ctx.storage.get<MapPayload>('map');
    if(old && Date.now()-old.generatedAt<86400000)return {...old,stale:false};
    if(!this.inflight)this.inflight=this.load(bounds).finally(()=>{this.inflight=null;});
    try{return await this.inflight;}
    catch(error){
      if(old && Date.now()-old.generatedAt<7*86400000)return {...old,stale:true};
      throw error;
    }
  }
  private async load(bounds: ReturnType<typeof cell>): Promise<MapPayload> {
    const bbox=[latitude(bounds.south),bounds.west/R*180/Math.PI,latitude(bounds.north),bounds.east/R*180/Math.PI].join(',');
    const key='hospital|school|college|university|library|townhall|police|fire_station|place_of_worship|bus_station';
    const query=`[out:json][timeout:22][maxsize:16777216];(way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|pedestrian)$"](${bbox});way[building][name](${bbox});way[building][amenity~"^(${key})$"](${bbox});way[building][tourism~"^(museum|attraction|gallery)$"](${bbox});way[historic~"^(castle|monument|memorial|building)$"](${bbox});node[amenity~"^(${key})$"][name](${bbox});node[railway=station][name](${bbox}););out geom;`;
    let raw,sourceProvider;
    for(const provider of MAP_PROVIDERS) {
      let phase='transport';
      try {
        const body='data='+encodeURIComponent(query.replace('[timeout:22]',`[timeout:${provider.querySeconds}]`));
        const response=await fetch(provider.url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'AsymptaWorld/1.0 (https://github.com/okok147/asympta-world)'},body,signal:AbortSignal.timeout(provider.timeout)});
        phase=`http_${response.status}`;
        if(!response.ok)throw Error('map_provider_unavailable');
        phase='response_decode';
        const candidate=await boundedJSON(response,4*1024*1024);
        phase='response_incomplete';
        if(candidate.remark||!Array.isArray(candidate.elements))throw Error('map_provider_incomplete');
        raw=candidate;sourceProvider=provider.name;break;
      } catch(error) {
        // Operational categories only: no URLs, cells, query text or credentials.
        const type=error instanceof Error && ['AbortError','TimeoutError','SyntaxError','TypeError'].includes(error.name)?error.name:'provider_error';
        console.warn(JSON.stringify({event:'map_provider_failed',provider:provider.name,phase,type}));
      }
    }
    if(!raw)throw Error('map_provider_unavailable');
    const result={schema:1,room:bounds.room,cellX:bounds.x,cellY:bounds.y,bounds,features:mapFeatures(raw,bounds),generatedAt:Date.now(),sourceTimestamp:raw.osm3s?.timestamp_osm_base||null,sourceProvider,attribution:ATTRIBUTION,attributionURL:'https://www.openstreetmap.org/copyright',stale:false};
    await this.ctx.storage.put('map',result);return result;
  }
}

/** Capability-token scoped growth; personal notes/names/location never enter this object. */
export class AuraProfile extends DurableObject {
  async read(): Promise<Growth> {return await this.ctx.storage.get<Growth>('growth')||{schema:1,abilities:[0,0,0,0,0],updatedAt:0};}
  async merge(abilities: number[]): Promise<Growth> {
    counts(abilities);
    return this.ctx.storage.transaction(async txn=>{
      const old=await txn.get<Growth>('growth')||{schema:1,abilities:[0,0,0,0,0],updatedAt:0};
      const result={schema:1,abilities:abilities.map((n,i)=>Math.max(n,old.abilities[i])),updatedAt:Date.now()};
      await txn.put('growth',result);return result;
    });
  }
}

/** One neighborhood, hibernating sockets, coarse presence only; no location database. */
export class AuraRoom extends DurableObject {
  async fetch(request) {
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'websocket_required'},426);
    const id=request.headers.get('X-Aura-Identity'),room=request.headers.get('X-Aura-Room');
    if(!id||!room)return json({error:'unauthorized'},401);
    const existing=this.ctx.getWebSockets();
    for(const ws of existing){const a=ws.deserializeAttachment();if(a?.id===id){try{ws.close(1000,'replaced');}catch{}}}
    if(existing.filter(ws=>ws.readyState===1).length>=80)return json({error:'room_full'},503);
    const pair=new WebSocketPair();const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({id,room,seen:0,lastMessage:0,visible:false});
    server.send(JSON.stringify({type:'welcome',id,room,positionPrecisionMeters:200}));
    return new Response(null,{status:101,webSocket:client});
  }
  webSocketMessage(ws,message) {
    const state=ws.deserializeAttachment();
    if(!state||typeof message!=='string'||message.length>MAX_MESSAGE){ws.close(1008,'invalid_message');return;}
    const now=Date.now();if(now-state.lastMessage<900){ws.close(1008,'too_fast');return;}
    try {
      const v=JSON.parse(message);
      if(v.type!=='presence'||!finite(v.latitude,-85,85)||!finite(v.longitude,-180,180)||!Number.isInteger(v.ink)||v.ink<0||v.ink>0xffffff)throw Error('invalid_presence');
      const abilities=counts(v.abilities);
      const radiusMeters=finite(v.radiusMeters,200,10000)?Math.ceil(v.radiusMeters/100)*100:200;
      const [rawX,rawY]=mercator(v.latitude,v.longitude);
      const x=Math.round(rawX/200)*200,y=Math.round(rawY/200)*200;
      const [cx,cy]=state.room.split(':').map(Number),bounds=cell(cx,cy);
      if(x<bounds.west-200||x>bounds.east+200||y<bounds.south-200||y>bounds.north+200)throw Error('outside_room');
      const p=[(x-bounds.west)/W*1000,(bounds.north-y)/H*1400];
      ws.serializeAttachment({...state,lastMessage:now,seen:now,visible:true,point:p,ink:v.ink,abilities,radiusMeters,activity:Number.isInteger(v.activity)&&v.activity>=0&&v.activity<5?v.activity:0});
      this.broadcast();
    }catch{ws.close(1008,'invalid_presence');}
  }
  broadcast(excluded=null) {
    const now=Date.now(),sockets=this.ctx.getWebSockets();
    const peers=sockets.filter(ws=>ws!==excluded&&ws.readyState===1).map(ws=>ws.deserializeAttachment()).filter(a=>a?.visible&&now-a.seen<45000).map(a=>({id:a.id,point:a.point,ink:a.ink,abilities:a.abilities,activity:a.activity,seen:a.seen,radiusMeters:a.radiusMeters}));
    const packet=JSON.stringify({type:'presence',peers,serverTime:now});
    for(const ws of sockets){if(ws===excluded)continue;try{ws.send(packet);}catch{}}
  }
  webSocketClose(ws,code,reason,wasClean){try{ws.close(code,reason);}catch{}this.broadcast(ws);}
  webSocketError(ws){try{ws.close(1011,'connection_error');}catch{}this.broadcast(ws);}
}

async function circleRequest(request: Request, env: Env, route: NonNullable<ReturnType<typeof matchCircleRoute>>) {
  const actor = await identity(request, `asympta-world:circle:v1:${route.circleID}:`);
  if (!actor) return json({ error: 'authorization_required' }, 401);
  // Keep new traffic separate from the map/presence budget. Bound creation and
  // join attempts per network as the native capability is self-generated.
  const key = request.headers.get('CF-Connecting-IP') || actor;
  const budget = route.action === 'create' || route.action === 'join' ? env.CIRCLE_ENTRY_RATE : env.CIRCLE_RATE;
  try {
    if (!(await budget.limit({ key })).success) return json({ error: 'rate_limited' }, 429);
    let body = null;
    if (request.method === 'POST' && route.action !== 'leave') {
      try {
        body = await boundedJSON(request, route.action === 'publish' ? 224_000 : 4096);
      } catch (error) {
        if (error instanceof Error && error.message === 'body_too_large') {
          return json({ error: 'body_too_large' }, 413);
        }
        return json({ error: 'invalid_input' }, 400);
      }
    }
    const result = await env.CIRCLES.getByName(route.circleID).dispatch(
      route.circleID, actor, route.action, route.target, body,
    );
    return json(result.body, result.status);
  } catch {
    console.error(JSON.stringify({ event: 'circle_route_failed', action: route.action, kind: 'runtime' }));
    return json({ error: 'temporarily_unavailable' }, 503);
  }
}

export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    if(url.pathname==='/health')return json({ok:true,service:'asympta-world-aura',schema:1,mapSource:'OpenStreetMap',locationStorage:'coarse_socket_presence_only',profileStorage:'durable_abilities_only',circles:'invitation_only_v1'});
    const social=matchCircleRoute(url.pathname,request.method);
    if(social)return circleRequest(request,env,social);
    const auth=await identity(request);
    if(!auth)return json({error:'authorization_required'},401);
    const rate=await env.API_RATE.limit({key:request.headers.get('CF-Connecting-IP')||auth});
    if(!rate.success)return json({error:'rate_limited'},429);
    try {
      if(url.pathname==='/v1/map' && request.method==='GET') {
        if(!url.searchParams.has('x')||!url.searchParams.has('y'))throw Error('invalid_cell');
        const x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y'));cell(x,y);
        const result=await env.MAPS.getByName(`${x}:${y}`).read(x,y);return json(result);
      }
      if(url.pathname==='/v1/profile') {
        const profile=env.PROFILES.getByName(auth);
        if(request.method==='GET')return json(await profile.read());
        if(request.method==='PUT'){const body=await boundedJSON(request,1024);return json(await profile.merge(counts(body.abilities)));}
      }
      if(url.pathname==='/v1/world' && request.method==='GET') {
        if(!url.searchParams.has('x')||!url.searchParams.has('y'))throw Error('invalid_cell');
        const x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y')),bounds=cell(x,y);
        const forward=new Request(request);forward.headers.set('X-Aura-Identity',auth);forward.headers.set('X-Aura-Room',bounds.room);
        return env.ROOMS.getByName(bounds.room).fetch(forward);
      }
      return json({error:'not_found'},404);
    }catch(error){
      const known=['invalid_cell','invalid_abilities','body_too_large','missing_body'];
      const message=error instanceof Error?error.message:'unavailable';
      // Do not log bearer tokens, geographic cells, map requests or peer data.
      console.error(JSON.stringify({event:'aura_request_failed',kind:known.includes(message)?message:'upstream_or_runtime'}));
      return json({error:known.includes(message)?message:'temporarily_unavailable'},known.includes(message)?400:503);
    }
  }
} satisfies ExportedHandler<Env>;
