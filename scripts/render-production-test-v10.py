from PIL import Image, ImageDraw, ImageFont
import os, subprocess, wave, shutil
W,H=1280,720; FPS=15
out='/mnt/data/AI-Guru-E2E-Production-Test-v10.mp4'; frames='/mnt/data/v10frames'; audio='/mnt/data/v10audio'
shutil.rmtree(frames,ignore_errors=True); shutil.rmtree(audio,ignore_errors=True); os.makedirs(frames); os.makedirs(audio)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; mlfont='/usr/share/fonts/truetype/noto/NotoSansMalayalam-Regular.ttf'
F=lambda s:ImageFont.truetype(font,s); M=lambda s:ImageFont.truetype(mlfont,s)
steps=[
('3x + 4 = 17','Start with the given equation.','ആദ്യം നൽകിയിരിക്കുന്ന സമവാക്യം എടുക്കാം.'),
('3x = 17 − 4','Subtract 4 from both sides.','രണ്ടു വശങ്ങളിൽ നിന്നും 4 കുറയ്ക്കുക.'),
('3x = 13','Simplify 17 − 4 to get 13.','17 − 4 കണക്കാക്കി 13 ലഭിക്കും.'),
('x = 13/3','Divide both sides by 3.','രണ്ടു വശങ്ങളെയും 3 കൊണ്ട് ഹരിക്കുക.')]
# create real speech files and segment durations
langs={'EN':'en-us','ML':'ml'}
segments=[]
for lang in ['EN','ML']:
  for i,(expr,en,ml) in enumerate(steps):
    text=en if lang=='EN' else ml
    wav=f'{audio}/{lang}{i}.wav'
    subprocess.run(['espeak','-v',langs[lang],'-s','145','-w',wav,text],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    with wave.open(wav,'rb') as w: sec=w.getnframes()/w.getframerate()
    segments.append((lang,i,wav,sec))
# fixed build/pause; audio is spoken during build, then silence until checkpoint
BUILD=1.8; PAUSE=2.0
# make frames and an audio timeline per pass
idx=0; concat=[]
for lang in ['EN','ML']:
  for i,(expr,en,ml) in enumerate(steps):
    _,_,wav,sec=segments[(0 if lang=='EN' else 4)+i]
    total=BUILD+PAUSE
    n=int(total*FPS)
    for k in range(n):
      phase='build' if k < BUILD*FPS else 'pause'; p=min(1,k/(BUILD*FPS-1))
      im=Image.new('RGB',(W,H),(15,18,25)); d=ImageDraw.Draw(im)
      # split classroom
      d.rectangle((0,0,639,H),fill=(29,33,43)); d.line((640,0,640,H),fill=(90,95,108),width=2)
      d.text((30,22),'AI GURU • NCERT MATHEMATICS',font=F(26),fill=(240,240,245))
      d.text((1035,25),'ENGLISH' if lang=='EN' else 'മലയാളം',font=F(22) if lang=='EN' else M(22),fill=(225,230,238))
      # reference
      d.rounded_rectangle((30,75,610,675),18,fill=(246,243,234),outline=(160,160,160),width=2)
      d.text((55,100),'NCERT REFERENCE',font=F(18),fill=(75,75,75)); d.text((55,155),'Solve the equation:',font=F(24),fill=(55,55,55)); d.text((55,205),'3x + 4 = 17',font=F(40),fill=(25,25,25)); d.text((55,275),'The reference remains visible',font=F(20),fill=(70,70,70)); d.text((55,310),'while the reasoning is constructed',font=F(20),fill=(70,70,70)); d.text((55,345),'step by step on the whiteboard.',font=F(20),fill=(70,70,70))
      # whiteboard
      d.rounded_rectangle((655,75,1250,675),18,fill=(250,250,250),outline=(160,160,160),width=2)
      d.text((680,100),'WHITEBOARD • cumulative derivation',font=F(18),fill=(70,70,70))
      basey=155; lineh=105
      for j in range(i+1):
        ex,ec,mc=steps[j]; y=basey+j*lineh; active=j==i
        # persistent line; current line reveals left-to-right
        if active:
          d.rounded_rectangle((680,y-12,1010,y+68),14,fill=(232,241,252),outline=(90,135,185),width=2)
        d.text((700,y),ex,font=F(36),fill=(25,25,30) if active else (100,100,105))
        cap=ec if lang=='EN' else mc; cf=F(16) if lang=='EN' else M(16)
        d.text((1015,y+2),cap,font=cf,fill=(35,35,40))
        marker='✓ #' if (j<i or phase=='pause') else '#'
        d.text((1190,y+35),marker,font=F(19),fill=(30,30,35))
      status='PAUSED — click # to learn the next line' if phase=='pause' else 'Speaking + constructing this line…'
      d.text((680,610),status,font=F(17),fill=(55,55,60))
      if i==3 and phase=='pause': d.text((1080,610),'↻ Repeat',font=F(18),fill=(55,55,60))
      d.rectangle((30,690,1250,695),fill=(55,58,65)); overall=( (0 if lang=='EN' else 4)+i+p)/8; d.rectangle((30,690,30+1220*overall,695),fill=(225,225,230))
      im.save(f'{frames}/f{idx:06d}.png'); idx+=1
    # append audio file then silence to fill segment
    segout=f'{audio}/seg_{lang}{i}.wav'
    # create padded segment with ffmpeg
    subprocess.run(['ffmpeg','-y','-i',wav,'-af',f'apad=pad_dur={max(0,total-sec):.3f}', '-t',str(total),segout],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    concat.append(segout)
# concatenate audio
with open(f'{audio}/list.txt','w') as f:
  for x in concat: f.write(f"file '{x}'\n")
fullwav=f'{audio}/full.wav'
subprocess.run(['ffmpeg','-y','-f','concat','-safe','0','-i',f'{audio}/list.txt','-c','copy',fullwav],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
# video then mux audio
silent='/mnt/data/v10_silent.mp4'
subprocess.run(['ffmpeg','-y','-framerate',str(FPS),'-i',f'{frames}/f%06d.png','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',silent],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['ffmpeg','-y','-i',silent,'-i',fullwav,'-c:v','copy','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',out],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(out)
