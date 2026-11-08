from PIL import Image, ImageDraw, ImageFont
import os, math, subprocess, shutil
W,H=1280,720
FPS=30
outdir='/mnt/data/aiguru_render_frames'
shutil.rmtree(outdir, ignore_errors=True); os.makedirs(outdir)
font_math='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
font_bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font_ml='/usr/share/fonts/truetype/noto/NotoSerifMalayalam-Regular.ttf'
font_ml_bold='/usr/share/fonts/truetype/noto/NotoSerifMalayalam-Bold.ttf'
FM=ImageFont.truetype(font_math,48); FB=ImageFont.truetype(font_bold,28); FC=ImageFont.truetype(font_bold,22); FML=ImageFont.truetype(font_ml,29); FMLB=ImageFont.truetype(font_ml_bold,31)
steps=[
 ('x² + 4x − 5 = 0','Focus on the middle term 4x.','ആദ്യം മധ്യപദമായ 4x-ൽ ശ്രദ്ധ കേന്ദ്രീകരിക്കാം.'),
 ('x² + 4x + 4 − 9 = 0','Add 4 and subtract 4 to complete the square.','പൂർണ്ണവർഗ്ഗം ആക്കാൻ 4 ചേർത്ത് 4 കുറയ്ക്കാം.'),
 ('(x + 2)² = 9','Group the perfect square and simplify.','ഇപ്പോൾ പൂർണ്ണവർഗ്ഗം കൂട്ടിച്ചേർത്ത് ലളിതമാക്കാം.'),
 ('x + 2 = ±3','Take the square root of both sides.','രണ്ടു വശങ്ങളുടെയും വർഗമൂലം എടുക്കാം.'),
 ('x = 1  or  x = −5','The two solutions are 1 and −5.','അതിനാൽ രണ്ട് പരിഹാരങ്ങൾ 1 ഉം −5 ഉം ആണ്.')]
prev=None

def text(draw,xy,s,font,fill=(245,245,248),anchor=None): draw.text(xy,s,font=font,fill=fill,anchor=anchor)
def token_positions(s, y=285):
    # simple visual token layout preserving individual token identity
    toks=[]; cur=''
    for ch in s:
        if ch.isalnum() or ch in '²': cur+=ch
        else:
            if cur: toks.append(cur);cur=''
            if ch!=' ': toks.append(ch)
    if cur:toks.append(cur)
    widths=[max(34, len(t)*28+8) for t in toks]; total=sum(widths)+12*(len(toks)-1); x=(W//2+W//2+0)-total/2
    # stage coordinates relative to right panel (640..1280)
    x=640+(640-total)/2
    return [(t,x+i*0,y) for i,(t,_) in enumerate(zip(toks,widths))]

def wrap(draw,s,font,maxw):
    words=s.split(); lines=[]; line=''
    for w in words:
        test=(line+' '+w).strip()
        if draw.textbbox((0,0),test,font=font)[2]<=maxw: line=test
        else: lines.append(line); line=w
    if line:lines.append(line)
    return lines

# fixed token parser with x positions
def layout(s):
    raw=[]; cur=''
    for ch in s:
        if ch.isalnum() or ch in '²': cur+=ch
        else:
            if cur: raw.append(cur);cur=''
            if ch!=' ': raw.append(ch)
    if cur:raw.append(cur)
    widths=[max(34,28*len(t)+12) for t in raw]
    total=sum(widths)+10*max(0,len(raw)-1); x=960-total/2
    return [(t,x0,285) for t,x0 in [(raw[i], x+sum(widths[:i])+10*i) for i in range(len(raw))]]

def draw_math(draw, current, previous_lines, p, focus, phase):
    # Manim-style cumulative derivation: never replace completed mathematical
    # states. The current line is constructed underneath the previous lines.
    lines = list(previous_lines) + [current]
    base_y = 220
    for li, line in enumerate(lines):
        is_current = li == len(lines) - 1
        cur = layout(line)
        old = layout(previous_lines[-1]) if previous_lines and is_current else []
        line_progress = p if is_current else 1.0
        for i,(tok,x,y) in enumerate(cur):
            op=max(0,min(1,(line_progress-(i/max(1,len(cur)))*0.12)/0.48))
            ox=old[i][1] if i<len(old) else x
            px=ox+(x-ox)*min(1,line_progress*1.35) if is_current else x
            py=base_y + li*78 - 10*(1-op)
            fill=(248,248,250) if is_current else (205,207,216)
            if is_current and i==focus and phase!='final':
                draw.rounded_rectangle((px-25,py-38,px+max(25,(len(tok)*28)),py+34),radius=12,outline=(240,240,245),width=3)
            draw.text((px,py),tok,font=FM,fill=fill,anchor='lm')
        if not is_current:
            draw.text((760,base_y + li*78),'✓',font=FC,fill=(150,153,163),anchor='mm')
    if phase=='balance':
        draw.text((960,base_y+78+42),'+4     −4',font=FC,fill=(220,220,225),anchor='mm')
    elif phase=='square':
        draw.text((960,base_y+2*78+42),'perfect-square form',font=FC,fill=(220,220,225),anchor='mm')
    elif phase=='root':
        draw.text((960,base_y+3*78+42),'√  both sides',font=FC,fill=(220,220,225),anchor='mm')
    elif phase=='final':
        draw.rounded_rectangle((790,base_y+4*78-40,1130,base_y+4*78+40),radius=24,outline=(245,245,248),width=4)
        draw.text((960,base_y+4*78+58),'FINAL SOLUTIONS',font=FC,fill=(230,230,235),anchor='mm')

# 5 English + 5 Malayalam, each step 2.4 sec
idx=0
for lang in [0,1]:
  for si,(expr,en,ml) in enumerate(steps):
    prev_expr=steps[si-1][0] if si else ''
    duration=2.4
    n=int(duration*FPS)
    for f in range(n):
      p=f/max(1,n-1)
      im=Image.new('RGB',(W,H),(10,12,18)); d=ImageDraw.Draw(im)
      # panels
      d.rectangle((0,0,639,H),fill=(20,23,31)); d.line((640,0,640,H),fill=(60,64,74),width=2)
      text(d,(36,30),'NCERT REFERENCE',FB,(170,172,182)); text(d,(36,75),'Page 84',FC,(140,142,152))
      source='Solve x² + 4x − 5 = 0 by completing the square.'
      for j,line in enumerate(wrap(d,source,FM,540)): text(d,(36,145+j*62),line,FM,(225,225,230))
      # right header
      text(d,(676,30),'AI GURU WHITEBOARD',FB,(170,172,182)); text(d,(676,70),('PASS 1 — ENGLISH' if lang==0 else 'PASS 2 — MALAYALAM'),FC,(210,210,220))
      # phase
      phase=['focus','balance','square','root','final'][si]
      focus=[2,4,1,1,4][si] if lang==0 else [2,4,1,1,4][si]
      draw_math(d,expr,steps[:si] and [x[0] for x in steps[:si]] or [],p,focus,phase)
      # construction trails
      if si>0 and p<0.75:
        for k in range(3):
          yy=500+k*22; x0=760+k*70; x1=x0+80
          a=max(0,(p-k*.12)/.55); d.line((x0,yy,x0+80*a,yy),fill=(145,148,158),width=3)
      # caption area
      d.rounded_rectangle((676,535,1238,675),radius=22,outline=(70,74,84),width=2)
      cap=en if lang==0 else ml
      font=FC if lang==0 else FML
      lines=wrap(d,cap,font,510)
      for j,line in enumerate(lines[:3]): text(d,(704,568+j*38),line,font,(242,242,246))
      # progress
      total_steps=10; overall=(lang*5+si+p)/10
      d.rectangle((36,686,1240,691),fill=(50,53,62)); d.rectangle((36,686,36+1204*overall,691),fill=(235,235,240))
      im.save(f'{outdir}/f{idx:05d}.png'); idx+=1
      
subprocess.run(['ffmpeg','-y','-framerate',str(FPS),'-i',f'{outdir}/f%05d.png','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart','/mnt/data/AI-Guru-Universal-Visual-Construction-v5.mp4'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print('/mnt/data/AI-Guru-Universal-Visual-Construction-v5.mp4')
