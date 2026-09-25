import { Steering } from '../Steering.js';

namespace `examples.flocking` (
  class FlockingField extends Component {
    static tag = 'arc-flocking-field';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.canvas = this.querySelector('canvas');
      this.context = this.canvas.getContext('2d', { alpha: false });
      this.model = new Steering(400);
      this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.sourceOpen = false;
      this.mode = 'attract';
      this.frames = 0;
      this.lastMeter = 0;
      this.fps = 0;
      this.on('pointermove', event => this.movePointer(event), false, this.canvas);
      this.on('pointerdown', event => {
        this.canvas.setPointerCapture(event.pointerId);
        this.movePointer(event);
        this.model.pointer.repel = event.pointerType === 'mouse' || this.mode === 'repel';
      }, false, this.canvas);
      this.on('pointerup', event => this.releasePointer(event), false, this.canvas);
      this.on('pointercancel', event => this.releasePointer(event), false, this.canvas);
      this.on('pointerleave', () => { this.model.pointer.active = false; }, false, this.canvas);
      this.on('keydown', event => this.keyInput(event), false, this.canvas);
      this.on('keyup', event => { if (event.code === 'Space') this.model.pointer.repel = this.mode === 'repel'; }, false, this.canvas);
      this.on('blur', () => { this.model.pointer.active = false; }, true, this.canvas);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this);
      this.resize();
      this.fire('flocking:ready', { field: this });
    }

    get running() { return !this.paused && !this.sourceOpen; }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.pixelRatio = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(rect.width * this.pixelRatio);
      this.canvas.height = Math.round(rect.height * this.pixelRatio);
      this.model.resize(rect.width, rect.height);
      this.onDraw(1);
    }

    movePointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      Object.assign(this.model.pointer, {
        x: event.clientX - rect.left, y: event.clientY - rect.top,
        active: true, repel: this.mode === 'repel' || (event.pointerType === 'mouse' && event.buttons === 1),
      });
      if (!this.running) this.onDraw(1);
    }

    releasePointer(event) {
      this.model.pointer.repel = this.mode === 'repel';
      if (event.pointerType !== 'mouse') this.model.pointer.active = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }

    keyInput(event) {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Escape'].includes(event.code)) return;
      event.preventDefault();
      const pointer = this.model.pointer;
      if (!pointer.active) { pointer.x = this.model.width / 2; pointer.y = this.model.height / 2; }
      pointer.active = event.code !== 'Escape';
      if (event.code === 'Space') pointer.repel = true;
      if (event.code === 'ArrowLeft') pointer.x -= 24;
      if (event.code === 'ArrowRight') pointer.x += 24;
      if (event.code === 'ArrowUp') pointer.y -= 24;
      if (event.code === 'ArrowDown') pointer.y += 24;
      pointer.x = Math.max(0,Math.min(this.model.width,pointer.x));
      pointer.y = Math.max(0,Math.min(this.model.height,pointer.y));
      if (!this.running) this.onDraw(1);
    }

    setMode(mode) {
      this.mode = mode;
      this.model.pointer.repel = mode === 'repel';
      this.querySelector('#world-hint').textContent = mode === 'repel' ? 'Move or touch to repel' : 'Move to attract · Hold to repel';
    }

    setPaused(paused) {
      this.paused = paused;
      this.frames = 0; this.lastMeter = 0;
      this.fire('flocking:playback');
    }

    onUpdate(timestamp) {
      if (!this.lastMeter) this.lastMeter = timestamp;
      this.frames++;
      if (timestamp - this.lastMeter >= 700) {
        this.fps = Math.round(this.frames * 1000 / (timestamp - this.lastMeter));
        this.fire('flocking:metrics', { fps: this.fps, agents: this.model.birds.length });
        this.frames = 0; this.lastMeter = timestamp;
      }
    }

    onFixedUpdate(milliseconds) {
      if (this.running) this.model.step(milliseconds / 1000);
    }

    onDraw(interpolation = 1) {
      if (!this.context || !this.model) return;
      const ctx = this.context, { width, height, birds } = this.model;
      ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
      ctx.fillStyle = '#070c15'; ctx.fillRect(0,0,width,height);
      const wash = ctx.createRadialGradient(width*.5,height*.6,0,width*.5,height*.6,width*.65);
      wash.addColorStop(0,'#101631'); wash.addColorStop(1,'#070c15');
      ctx.fillStyle=wash; ctx.fillRect(0,0,width,height);
      ctx.strokeStyle = '#7a95d00c'; ctx.lineWidth = 1; ctx.beginPath();
      for(let x=0;x<width;x+=24){ctx.moveTo(x,0);ctx.lineTo(x,height);}
      for(let y=0;y<height;y+=24){ctx.moveTo(0,y);ctx.lineTo(width,y);}
      ctx.stroke();
      if (this.model.obstaclesEnabled) for (const obstacle of this.model.obstacles) {
        ctx.beginPath(); ctx.arc(obstacle.x,obstacle.y,obstacle.radius,0,Math.PI*2);
        ctx.fillStyle='#090f1e';ctx.fill();ctx.strokeStyle='#475d875f';ctx.stroke();
        ctx.beginPath();ctx.moveTo(obstacle.x-7,obstacle.y);ctx.lineTo(obstacle.x+7,obstacle.y);
        ctx.moveTo(obstacle.x,obstacle.y-7);ctx.lineTo(obstacle.x,obstacle.y+7);ctx.stroke();
      }
      const colors = ['#679aff','#9276ff','#5bc8ed'];
      for (const bird of birds) {
        const x=bird.px+(bird.x-bird.px)*interpolation, y=bird.py+(bird.y-bird.py)*interpolation;
        const angle=Math.atan2(bird.vy,bird.vx), dx=Math.cos(angle), dy=Math.sin(angle);
        ctx.strokeStyle=colors[bird.tone]+'30';ctx.beginPath();ctx.moveTo(x-dx*5,y-dy*5);ctx.lineTo(x-dx*18,y-dy*18);ctx.stroke();
        ctx.fillStyle=colors[bird.tone];ctx.beginPath();ctx.moveTo(x+dx*4.5,y+dy*4.5);
        ctx.lineTo(x-dx*3-dy*2,y-dy*3+dx*2);ctx.lineTo(x-dx,y-dy);
        ctx.lineTo(x-dx*3+dy*2,y-dy*3-dx*2);ctx.closePath();ctx.fill();
      }
      const pointer=this.model.pointer;
      if(pointer.active){ctx.beginPath();ctx.arc(pointer.x,pointer.y,48,0,Math.PI*2);ctx.strokeStyle=pointer.repel?'#e6ab7d88':'#809fff66';ctx.stroke();}
    }

    onDisconnected() { this.resizeObserver?.disconnect(); }
  }
);
