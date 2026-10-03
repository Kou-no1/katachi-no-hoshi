import type { LabId } from './types';
export interface LearningLab { id:LabId; name:string; stage:string; caption:string; goal:number; icon:string; }
export const LEARNING_LABS: readonly LearningLab[] = [
  {id:'puzzle',name:'かたち工房',stage:'さわって合わせる',caption:'ピースを動かして、形をつくる',goal:2,icon:'<path d="M9 49V15h34Z" fill="#ed9a78"/><path d="M18 54h37V17Z" fill="#80b49d"/>'},
  {id:'blocks',name:'ブロック建築',stage:'見て、作る',caption:'かくれたブロックと、自分の基地',goal:6,icon:'<path d="m12 24 20-11 20 11-20 11Z" fill="#bad5c6"/><path d="M12 24v24l20 11V35Z" fill="#82b59f"/><path d="M32 35v24l20-11V24Z" fill="#4e8974"/>'},
  {id:'transform',name:'かたちの変身',stage:'平面を考える',caption:'対称・拡大縮小・面積',goal:9,icon:'<path d="M6 18h20v28H6Z" fill="#ed9a78"/><path d="M38 18h20v28H38Z" fill="#89b5d1"/><path d="M32 8v48" stroke="#294f49" stroke-width="2" stroke-dasharray="4 4"/>'},
  {id:'box',name:'はこづくり研究所',stage:'平面と立体をつなぐ',caption:'展開図・体積・表面積',goal:15,icon:'<path d="M24 6h16v16h16v16H40v20H24V38H8V22h16Z" fill="#89b5d1"/><path d="M24 22h16v16H24Zm0-16v16m16 0V6m-16 32v20m16-20v20" fill="none" stroke="#294f49" stroke-width="2"/>'},
  {id:'reconstruction',name:'３つの図から作る',stage:'立体を読みとる',caption:'前・横・上の図から復元',goal:3,icon:'<path d="M5 13h20v20H5ZM36 13h22v20H36ZM21 41h22v18H21Z" fill="#b7a1c8"/><path d="m26 28 6 10 5-10" fill="none" stroke="#294f49" stroke-width="2"/>'},
  {id:'solids',name:'くるくる・切ってみる',stage:'中学につながる空間',caption:'回転体と、立体の断面',goal:6,icon:'<ellipse cx="22" cy="17" rx="14" ry="7" fill="#bad5c6"/><path d="M8 17v28c0 10 28 10 28 0V17" fill="#81b8a2"/><path d="m43 10 17 43H38Z" fill="#e6c573"/>'},
];
export const labCompletedCount=(id:LabId,completed:Record<string,string>)=>Object.keys(completed).filter(key=>key.startsWith(id+'-')).length;
