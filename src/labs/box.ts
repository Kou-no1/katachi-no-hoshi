import * as THREE from 'three';
import { CUBE_NETS, facePose, foldMatrices, oppositeFace, type FaceId } from '../geometry/box';
import { createThreeStage } from '../shared/three-stage';
import type { GameContext } from '../types';

export function mountBox(container: HTMLElement, context: GameContext): () => void {
  let netIndex=0;
  const faces=()=>CUBE_NETS[netIndex].faces;
  container.innerHTML = `
    <div class="box-net-picker" aria-label="展開図をえらぶ">${CUBE_NETS.map((net,i)=>`<button type="button" class="button button-soft" data-cube-net="${i}" aria-pressed="${i===0}">${i+1}. ${net.name}</button>`).join('')}</div>
    <div class="lab-layout box-lab">
      <div class="lab-stage">
        <div class="stage-toolbar"><h2>ひらいた形から、はこへ</h2><span class="badge">ゆっくり折ってみよう</span></div>
        <div class="stage-workspace">
          <div class="canvas-host box-canvas" role="img" aria-label="６つの番号つきの面を折ってつくる立方体。ドラッグで見る向きを変えられます。"></div>
          <aside class="stage-controller box-fold-controls" aria-label="箱を折る操作">
            <h3 class="box-controller-title">折ってみよう</h3>
            <div class="box-fold-label"><label for="box-fold">折りぐあい</label><output id="box-fold-output">0%</output></div>
            <input id="box-fold" type="range" min="0" max="100" step="1" value="0" aria-label="箱の折りぐあい">
            <div class="button-row"><button type="button" class="button button-soft" data-fold="0">ひらく</button><button type="button" class="button button-primary" data-fold="1">はこにする</button><button type="button" class="button" id="box-home-view">見やすい向き</button></div>
          </aside>
        </div>
        <p class="stage-caption">スライダーで少しずつ折れるよ。箱をなでると、見る向きが変わるよ。</p>
      </div>
      <div class="lab-sidebar">
        <section class="panel"><p class="task-kicker">MISSION / はこを予想する</p><h3 class="task-title"></h3><p class="task-description">はこにしたら、どの面が向かい合うかな？ 先にえらんで、折ってたしかめよう。</p><div class="box-answers" aria-label="向かいの面をえらぶ"></div><button type="button" id="box-check" class="button button-primary box-check" disabled>たしかめる</button><p class="feedback" aria-live="polite"></p><div class="button-row"><button type="button" id="box-next" class="button button-soft">べつの面で考える</button><button type="button" id="box-hint" class="button">ヒント</button></div><p class="hint" hidden>向かいの面は、辺でくっついていないよ。ゆっくり折って、どこへ動くか見てみよう。</p></section>
        <section class="panel box-net-panel"><h3 class="panel-title">ひらいた形の地図</h3><div class="box-net"></div><p class="small-text">番号を手がかりに、同じ面をさがそう。</p></section>
      </div>
    </div>`;
  const $ = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const host = $('.box-canvas');
  let stage: ReturnType<typeof createThreeStage> | undefined;
  let amount = 0;
  let selected: FaceId | null = null;
  let questionIndex = 0;
  let animation = 0;
  let disposed = false;
  let questions: FaceId[] = [1,2,4];
  const meshes = new Map<FaceId, THREE.Mesh>();
  const labels = new Map<FaceId, THREE.Sprite>();
  const textures: THREE.Texture[] = [];
  const slider = $<HTMLInputElement>('#box-fold');
  const feedback = $('.feedback');

  function drawNet() {
    const side = 46;
    const matrices = foldMatrices(0,faces());
    const centers=[...matrices.values()].map(m=>new THREE.Vector3().applyMatrix4(m));
    const minX=Math.min(...centers.map(p=>p.x)),maxX=Math.max(...centers.map(p=>p.x)),minY=Math.min(...centers.map(p=>p.y)),maxY=Math.max(...centers.map(p=>p.y));
    $('.box-net').innerHTML = `<svg viewBox="0 0 ${(maxX-minX+1)*side+20} ${(maxY-minY+1)*side+20}" role="img" aria-label="${CUBE_NETS[netIndex].name}の展開図。色と番号で同じ面をさがせます。">${faces().map(face => {
      const center = new THREE.Vector3().applyMatrix4(matrices.get(face.id)!);
      const x = 10 + (center.x-minX)*side; const y = 10+(maxY-center.y)*side;
      return `<g><rect x="${x}" y="${y}" width="${side}" height="${side}" fill="${face.color}" stroke="#294f49" stroke-width="1.5"/><text x="${x+side/2}" y="${y+side/2+6}" text-anchor="middle" fill="#294f49" font-size="19" font-weight="700">${face.id}</text></g>`;
    }).join('')}</svg>`;
  }

  function updateLabels() {
    if (!stage) return;
    const viewDirection = stage.camera.getWorldDirection(new THREE.Vector3());
    stage.scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const face of faces()) {
      const pose = facePose(face.id,amount,faces());
      const facing = -pose.normal.dot(viewDirection);
      const label = labels.get(face.id)!;
      // A billboard can intersect its slanted face. Draw the label above the face,
      // but explicitly test center occlusion so rear-face numbers never show through.
      ray.set(pose.center.clone().addScaledVector(viewDirection,-20),viewDirection);
      const nearest = ray.intersectObjects([...meshes.values()],false)[0];
      label.visible = Math.abs(facing) >= .25 && nearest?.object === meshes.get(face.id);
      label.position.copy(pose.center).addScaledVector(pose.normal,.014*(facing >= 0 ? 1 : -1));
    }
  }

  try {
    stage = createThreeStage(host,{span:5.2,position:new THREE.Vector3(5,4,8),target:new THREE.Vector3(0,.45,.35)});
    const geometry = new THREE.PlaneGeometry(1,1);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    for (const face of faces()) {
      const mesh = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:face.color,side:THREE.DoubleSide,roughness:.95}));
      mesh.matrixAutoUpdate = false;
      mesh.add(new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color:0x294f49})));
      stage.scene.add(mesh); meshes.set(face.id,mesh);
      const canvas = document.createElement('canvas'); canvas.width=128; canvas.height=128;
      const ctx=canvas.getContext('2d')!;
      ctx.fillStyle='#294f49'; ctx.font='bold 84px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(face.id),64,67);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));
      label.renderOrder=10;
      label.scale.set(.26,.26,1); stage.scene.add(label); labels.set(face.id,label);
    }
    stage.controls.addEventListener('change',()=>{updateLabels();stage?.render();});
  } catch {
    host.classList.add('box-fallback');
    host.innerHTML = '<div><p>この画面では、箱を動かす表示が使えません。</p><p>右の「ひらいた形の地図」で、番号をたしかめながら考えてみよう。</p></div>';
    slider.disabled=true;
    container.querySelectorAll<HTMLButtonElement>('[data-fold],#box-home-view').forEach(button=>button.disabled=true);
  }

  function setAmount(value: number) {
    amount=Math.max(0,Math.min(1,value));
    slider.value=String(Math.round(amount*100));
    $('#box-fold-output').textContent=`${Math.round(amount*100)}%`;
    if (stage) {
      const matrices=foldMatrices(amount,faces());
      meshes.forEach((mesh,id)=>mesh.matrix.copy(matrices.get(id)!));
      const center=new THREE.Vector3();
      for(const m of matrices.values())center.add(new THREE.Vector3().applyMatrix4(m));
      center.divideScalar(6);
      const delta=center.clone().sub(stage.controls.target);
      stage.camera.position.add(delta);stage.controls.target.copy(center);stage.camera.lookAt(center);
      stage.setSpan(5.2-2.5*amount);
      updateLabels(); stage.render();
    }
  }

  function animateTo(target: number) {
    cancelAnimationFrame(animation);
    if (context.reducedMotion) { setAmount(target); return; }
    const start=amount; const began=performance.now();
    const tick=(time:number)=>{
      if(disposed)return;
      const t=Math.min((time-began)/950,1);
      setAmount(start+(target-start)*(t*t*(3-2*t)));
      if(t<1)animation=requestAnimationFrame(tick);
    };
    animation=requestAnimationFrame(tick);
  }

  function showQuestion() {
    selected=null;
    const target=questions[questionIndex];
    $('.task-title').textContent=`${target}の面の、向かいは？`;
    $('.box-answers').innerHTML=faces().filter(face=>face.id!==target).map(face=>`<button type="button" class="button box-answer" data-face="${face.id}" aria-pressed="false"><span style="background:${face.color}">${face.id}</span></button>`).join('');
    $('.box-answers').querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.addEventListener('click',()=>{
      selected=Number(button.dataset.face) as FaceId;
      $('.box-answers').querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      $<HTMLButtonElement>('#box-check').disabled=false;
      feedback.textContent=''; feedback.className='feedback';
    }));
    $<HTMLButtonElement>('#box-check').disabled=true;
    feedback.textContent=''; feedback.className='feedback';
    $('.hint').hidden=true;
    cancelAnimationFrame(animation); setAmount(0);
  }
  $('#box-check').addEventListener('click',()=>{
    const target=questions[questionIndex];
    if(selected===null)return;
    if(selected===oppositeFace(target,faces())) {
      feedback.className='feedback success';
      feedback.textContent=`発見！ ${target}と${selected}は、向かい合う面だね。箱を回してたしかめよう。`;
      context.onComplete(netIndex===0?'box-'+target:`box-net-${CUBE_NETS[netIndex].id}-${target}`,`${CUBE_NETS[netIndex].name}・${target}の面の向かい`);
      animateTo(1);
    } else {
      feedback.className='feedback error';
      feedback.textContent='もう一度ためそう。ゆっくり折ると、面の動きが見えるよ。';
    }
  });
  $('#box-next').addEventListener('click',()=>{questionIndex=(questionIndex+1)%questions.length;showQuestion();});
  $('#box-hint').addEventListener('click',()=>{$('.hint').hidden=!$('.hint').hidden;});
  slider.addEventListener('input',()=>{cancelAnimationFrame(animation);setAmount(Number(slider.value)/100);});
  container.querySelectorAll<HTMLButtonElement>('[data-fold]').forEach(button=>button.addEventListener('click',()=>animateTo(Number(button.dataset.fold))));
  $('#box-home-view').addEventListener('click',()=>{
    if(stage){const center=stage.controls.target.clone();stage.setCamera(center.clone().add(new THREE.Vector3(5,4,8)),center);}
  });
  container.querySelectorAll<HTMLButtonElement>('[data-cube-net]').forEach(button=>button.addEventListener('click',()=>{
    netIndex=Number(button.dataset.cubeNet);questionIndex=0;questions=netIndex===0?[1,2,4]:[1,2,5];
    container.querySelectorAll<HTMLElement>('[data-cube-net]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    drawNet();showQuestion();context.onNarrate?.(`${CUBE_NETS[netIndex].name}。どの面が向かい合うかな？`);
  }));
  drawNet(); showQuestion();
  return ()=>{disposed=true;cancelAnimationFrame(animation);textures.forEach(texture=>texture.dispose());labels.forEach(label=>label.material.dispose());stage?.dispose();};
}
