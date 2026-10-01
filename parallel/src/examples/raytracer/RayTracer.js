// This entire function is serialized by Cocoon's ThreadPool. Keep its scene and
// helpers inside the function: workers do not inherit this module's imports.
export function renderTile(job) {
  const { x, y, width, height, imageWidth, imageHeight, samples, sampleStart = 0, depth = 5 } = job;
  const output = new Float32Array(width * height * 3);
  if (!width || !height) return { ...job, pixels: output.buffer };
  const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const mul = (a, s) => [a[0]*s, a[1]*s, a[2]*s];
  const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm = a => mul(a, 1 / Math.sqrt(dot(a,a)));
  const mix = (a,b,t) => a.map((v,i) => v*(1-t)+b[i]*t);
  let seed = 1;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const spheres = [
    { c:[-0.28,1.22,-0.45], r:1.22, color:[0.94,0.96,1], metal:true, rough:0.008 },
    { c:[1.95,0.88,0.38], r:0.88, color:[0.15,0.045,0.42], rough:0.035 },
    { c:[-2.05,0.55,1.35], r:0.55, color:[0.22,0.72,0.49], rough:0.045 },
  ];
  // Rectangular softboxes are real emissive surfaces, visible in reflected rays.
  const panel = (c, target, w, h, color, power) => {
    const n = norm(sub(target,c));
    const u = norm(cross(Math.abs(n[1]) > 0.99 ? [0,0,1] : [0,1,0], n));
    return { c,n,u,v:cross(n,u),w,h,color,power };
  };
  const lights = [
    panel([-3.5,6,2.5], [0,0,0], 3.5, 2.3, [1,0.96,0.91], 5.8),
    panel([4,4.6,1], [0,0,0], 1.5, 3.2, [0.76,0.84,1], 4.4),
    panel([0,5,-4], [0,0.8,0], 4.2, 1.1, [0.77,0.82,1], 4.5),
  ];
  function intersect(o,d,limit=1e5, floor=true) {
    let t=limit, object=null;
    for (const sphere of spheres) {
      const q=sub(o,sphere.c), b=dot(q,d), c=dot(q,q)-sphere.r*sphere.r;
      const disc=b*b-c;
      if (disc < 0) continue;
      const root=Math.sqrt(disc);
      let near=-b-root;
      if (near < 0.0001) near=-b+root;
      if (near > 0.0001 && near < t) { t=near; object=sphere; }
    }
    if (floor && d[1] < -0.00001) {
      const plane=-o[1]/d[1];
      if (plane > 0.0001 && plane < t) { t=plane; object='floor'; }
    }
    return object ? {t,object} : null;
  }
  function environment(d) {
    // Broad photographic fill gives chrome its silver gradients between softboxes.
    const overhead=Math.pow(Math.max(0,d[1]),0.65);
    const sweep=Math.pow(Math.max(0,dot(d,[-0.7,0.5,0.5])),8);
    const rim=Math.pow(Math.max(0,dot(d,[0.8,0.48,-0.36])),12);
    const ceiling=Math.pow(Math.max(0,dot(d,[0.12,0.91,0.39])),16);
    const fill=0.035*overhead+0.48*sweep+0.38*rim+0.18*ceiling;
    return [0.014+fill,0.018+fill*1.02,0.025+fill*1.08];
  }
  function backdrop(d) {
    const glow=Math.pow(Math.max(0,dot(d,norm([-0.3,0.05,-1]))),18);
    return [0.0015+0.003*glow,0.0025+0.006*glow,0.006+0.017*glow];
  }
  function jitterDirection(direction, roughness, normal) {
    if (!roughness) return direction;
    const u=norm(cross(Math.abs(direction[1])<0.95?[0,1,0]:[1,0,0],direction));
    const v=cross(direction,u), angle=random()*Math.PI*2;
    const radius=roughness*Math.sqrt(-Math.log(Math.max(1e-6,random())));
    const perturbed=norm(add(direction,add(mul(u,Math.cos(angle)*radius),mul(v,Math.sin(angle)*radius))));
    return dot(perturbed,normal)>0 ? perturbed : direction;
  }
  function trace(o,d,bounce) {
    const hit=intersect(o,d);
    let nearest=hit?.t ?? 1e5, emission=null;
    if (bounce>0) for (const light of lights) {
      const denominator=dot(d,light.n);
      if (denominator >= -0.00001) continue;
      const t=dot(sub(light.c,o),light.n)/denominator;
      if (t<=0.0001 || t>=nearest) continue;
      const q=sub(add(o,mul(d,t)),light.c);
      if (Math.abs(dot(q,light.u))<light.w/2 && Math.abs(dot(q,light.v))<light.h/2) {
        nearest=t; emission=mul(light.color,light.power);
      }
    }
    if (emission) return emission;
    if (!hit) return bounce ? environment(d) : backdrop(d);
    const p=add(o,mul(d,hit.t)), floor=hit.object==='floor';
    const normal=floor?[0,1,0]:norm(sub(p,hit.object.c));
    const origin=add(p,mul(normal,0.0003));
    const checker=((Math.floor(p[0]/0.9)+Math.floor(p[2]/0.9))%2+2)%2;
    const color=floor ? (checker?[0.22,0.26,0.34]:[0.027,0.040,0.066]) : hit.object.color;
    const metal=!floor && hit.object.metal;
    const cosine=Math.max(0,-dot(d,normal));
    const f0=metal?0.95:floor?0.12:0.065;
    const fresnel=f0+(1-f0)*Math.pow(1-cosine,5);
    let diffuse=[0,0,0];
    if (!metal) {
      // An ambient hemisphere gives the unlit side shape; one occlusion ray
      // anchors the objects without baking painted shadows into the scene.
      const u=norm(cross(Math.abs(normal[1])<0.95?[0,1,0]:[1,0,0],normal)), v=cross(normal,u);
      const r=Math.sqrt(random()), a=random()*Math.PI*2;
      const aoDirection=add(mul(normal,Math.sqrt(1-r*r)),add(mul(u,r*Math.cos(a)),mul(v,r*Math.sin(a))));
      const blocked=intersect(origin,aoDirection,2.2);
      const ambient=blocked?0.025:0.14;
      diffuse=color.map((c,i)=>c*ambient*[0.75,0.83,1][i]);
      for (const light of lights) {
        const point=add(light.c,add(mul(light.u,(random()-0.5)*light.w),mul(light.v,(random()-0.5)*light.h)));
        const delta=sub(point,origin), distance2=dot(delta,delta), distance=Math.sqrt(distance2), l=mul(delta,1/distance);
        const ndl=Math.max(0,dot(normal,l)), facing=Math.max(0,-dot(light.n,l));
        if (!ndl || !facing || intersect(origin,l,distance-0.001)) continue;
        const intensity=light.power*light.w*light.h*ndl*facing/(Math.PI*distance2);
        diffuse=add(diffuse,color.map((c,i)=>c*light.color[i]*intensity));
      }
    }
    const reflected=sub(d,mul(normal,2*dot(d,normal)));
    const roughness=floor?0.022:hit.object.rough;
    const ray=jitterDirection(reflected,roughness,normal);
    const reflection=bounce<depth ? trace(origin,ray,bounce+1) : environment(ray);
    let result=metal ? reflection.map((c,i)=>c*color[i]*fresnel) : mix(diffuse,reflection,fresnel);
    // A restrained distance fade hides the infinite plane's high-frequency horizon.
    if (floor) result=mix(result,backdrop(d),1-Math.exp(-Math.max(0,hit.t-9)*0.07));
    return result;
  }
  const camera=job.camera || [0,3.05,8.8], target=[0,0.95,0];
  const forward=norm(sub(target,camera)), right=norm(cross(forward,[0,1,0])), up=cross(right,forward);
  const scale=Math.tan(34*Math.PI/360), aspect=imageWidth/imageHeight;
  let offset=0;
  for (let row=0;row<height;row++) for (let col=0;col<width;col++) {
    const px=x+col,py=y+row;
    for (let sample=sampleStart;sample<sampleStart+samples;sample++) {
      // Stable per pixel and sample: tile order and worker count cannot change the image.
      seed=(Math.imul(py*imageWidth+px+1,1973)^Math.imul(sample+1,9277)^0x68bc21eb)>>>0 || 1;
      random(); random();
      const sx=(2*(px+random())/imageWidth-1)*aspect*scale;
      const sy=(1-2*(py+random())/imageHeight)*scale;
      const direction=norm(add(forward,add(mul(right,sx),mul(up,sy))));
      const radiance=trace(camera,direction,0);
      for (let c=0;c<3;c++) output[offset+c]+=radiance[c];
    }
    offset+=3;
  }
  const result={x,y,width,height,samples,sampleStart,pixels:output.buffer};
  return typeof transfer==='function' ? transfer(result,[output.buffer]) : result;
}

export function displayPixels(linear, samples) {
  const pixels=new Uint8ClampedArray(linear.length/3*4);
  for (let i=0,j=0;i<linear.length;i+=3,j+=4) {
    for (let c=0;c<3;c++) {
      const x=Math.max(0,linear[i+c]/samples*1.25);
      const mapped=Math.min(1,(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14));
      pixels[j+c]=255*(mapped<=0.0031308 ? mapped*12.92 : 1.055*Math.pow(mapped,1/2.4)-0.055);
    }
    pixels[j+3]=255;
  }
  return pixels;
}
