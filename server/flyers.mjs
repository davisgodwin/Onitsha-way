/** Strict raster envelope checks. SVG, URLs, HTML, text-only and oversized uploads never enter a campaign. */
export function validateFlyer(image){
 if(typeof image!=='string'||!image||image.length>1200000)throw Error('Upload a business flyer image under 900 KB after resizing.');
 const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
 if(!m)throw Error('Only PNG, JPEG or WebP flyer images are supported.');
 const b=Buffer.from(m[2],'base64');if(b.length<32||b.length>900000||b.toString('base64')!==m[2])throw Error('Invalid flyer image data.');
 let w=0,h=0;
 if(m[1]==='png'){
  if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.toString('ascii',12,16)!=='IHDR'||b.toString('ascii',b.length-8,b.length-4)!=='IEND')throw Error('Invalid PNG flyer.');
  w=b.readUInt32BE(16);h=b.readUInt32BE(20);
 }else if(m[1]==='jpeg'){
  if(b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)throw Error('Invalid JPEG flyer.');
  let i=2;while(i+8<b.length){if(b[i++]!==255)continue;let marker=b[i++];while(marker===255)marker=b[i++];if(marker===218||marker===217)break;if(marker===216||marker===1||marker>=208&&marker<=215)continue;const len=b.readUInt16BE(i);if(len<2||i+len>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){h=b.readUInt16BE(i+3);w=b.readUInt16BE(i+5);break;}i+=len;}
 }else {
  if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP'||b.readUInt32LE(4)+8!==b.length)throw Error('Invalid WebP flyer.');
  const kind=b.toString('ascii',12,16);
  if(kind==='VP8X'){w=1+b.readUIntLE(24,3);h=1+b.readUIntLE(27,3);}
  else if(kind==='VP8L'&&b[20]===47){const bits=b.readUInt32LE(21);w=(bits&16383)+1;h=((bits>>>14)&16383)+1;}
  else if(kind==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42){w=b.readUInt16LE(26)&16383;h=b.readUInt16LE(28)&16383;}
 }
 if(!w||!h||w>4096||h>4096||w*h>12000000)throw Error('Invalid or oversized flyer dimensions.');
 return image;
}
