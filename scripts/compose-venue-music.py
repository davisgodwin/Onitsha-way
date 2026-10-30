import numpy as np, wave, subprocess
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'public/audio/afrobeat';out.mkdir(parents=True,exist_ok=True);sr=32000
for ti,(name,bpm,root) in enumerate([('iweka-afterglow',108,45),('niger-breeze',102,43),('market-lights',114,47)]):
 rng=np.random.default_rng(2700+ti);beat=60/bpm;bars=32;dur=bars*4*beat;audio=np.zeros((round(dur*sr),2),dtype=np.float64)
 def put(t,signal,amp=1,pan=0):
  i=round((t%dur)*sr);s=np.asarray(signal)*amp;g=np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)]);n=len(s);a=s[:,None]*g
  if i+n<=len(audio):audio[i:i+n]+=a
  else:
   audio[i:]+=a[:len(audio)-i];audio[:n-(len(audio)-i)]+=a[len(audio)-i:]
 def tone(t,note,length,amp,kind='keys',pan=0):
  x=np.arange(int(length*sr))/sr;f=440*2**((note-69)/12)
  if kind=='bass':s=(np.sin(2*np.pi*f*x)+.22*np.sin(4*np.pi*f*x))*np.minimum(1,x/.009)*np.exp(-x*5)
  elif kind=='guitar':s=sum(np.sin(2*np.pi*f*k*x)/k**1.5 for k in range(1,6))*np.exp(-x*12)*np.minimum(1,x/.003)
  elif kind=='horn':s=(np.sin(2*np.pi*f*x)+.3*np.sin(4*np.pi*f*x)+.12*np.sin(6*np.pi*f*x))*np.minimum(1,x/.025)*np.exp(-x*5)
  else:s=(np.sin(2*np.pi*f*x)+.28*np.sin(2*np.pi*f*2.003*x))*np.exp(-x*6)*np.minimum(1,x/.008)
  put(t,s,amp,pan)
 def drum(t,kind,amp=1):
  length={'kick':.23,'rim':.095,'hat':.055,'shaker':.08,'conga':.17}[kind];x=np.arange(int(length*sr))/sr;n=rng.normal(0,1,len(x))
  if kind=='kick':s=np.sin(2*np.pi*(45*x+2.5*(1-np.exp(-x*28))))*np.exp(-x*24)*.7
  elif kind=='rim':s=(np.sin(2*np.pi*980*x)*.5+np.sin(2*np.pi*1620*x)*.25+n*.25)*np.exp(-x*80)*.24
  elif kind=='conga':s=np.sin(2*np.pi*(175*x+.35*(1-np.exp(-x*30))))*np.exp(-x*24)*.23
  else:s=(n-np.roll(n,1))*np.exp(-x*(95 if kind=='hat' else 60))*.075
  put(t,s,amp,{'kick':0,'rim':.12,'conga':-.35,'hat':.45,'shaker':-.5}[kind])
 progression=[0,5,3,7];scale=[0,3,5,7,10,12,10,7]
 for bar in range(bars):
  b=bar*4*beat;offset=progression[(bar//2)%4];notes=[root+offset+12,root+offset+15,root+offset+19]
  for st in range(16):
   t=b+st*beat/4+(beat*.025 if st%2 else 0);drum(t,'shaker',.45 if st%2 else .65)
   if st%2==0:drum(t,'hat',.5 if st%4 else .8)
   if st in ([0,6,10] if bar%2==0 else [0,7,12,14]):drum(t,'kick',.85)
   if st in [4,12]:drum(t,'rim',.9)
   if st in [3,9,14]:drum(t,'conga',.55+.15*(st%3))
   if st in [0,3,7,10,14]:tone(t,root+offset+([0,0,7,10,7][[0,3,7,10,14].index(st)]),.25,.19,'bass')
   if st in [2,6,10,15]:
    for j,note in enumerate(notes):tone(t+j*.007,note+12,.18,.055,'guitar',-.4)
   if st in [0,7,11] and bar%8 not in [0,1]:
    for j,note in enumerate(notes):tone(t+j*.008,note,.42,.045,'keys',.35)
  if bar%8>=4:
   for k,st in enumerate([1,4,6,10,13,15]):tone(b+st*beat/4,root+24+scale[(k+bar+ti)%len(scale)],beat*.45,.065,'horn',.1)
 audio=np.tanh(audio*1.1);audio/=max(1,np.max(np.abs(audio))/.88)
 wav=out/(name+'.wav')
 with wave.open(str(wav),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((audio*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','160k',str(out/(name+'.mp3'))],check=True);wav.unlink();print(name,bpm,round(dur,3),flush=True)
