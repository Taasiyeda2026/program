from pathlib import Path
from PIL import Image, ImageOps, ImageChops
import re, json
root=Path(__file__).resolve().parents[1]/'images'
records=[]
for src in sorted(root.glob('*.png')):
    if not re.fullmatch(r'\d+(?:-\d+)?(?:\.[123])?',src.stem):
        raise ValueError(f'Unexpected name: {src.name}')
    dst=src.with_suffix('.webp')
    with Image.open(src) as im:
        im.load()
        im=ImageOps.exif_transpose(im).convert('RGBA')
        # Canva empty pages must never be treated as product photography.
        blank=all(lo==hi for lo,hi in im.getextrema()) or im.getchannel('A').getextrema()[1]==0
        suspicious=src.stat().st_size<5000
        im.save(dst,'WEBP',lossless=True,method=6)
        with Image.open(dst) as out:
            out.load()
            if out.format!='WEBP' or out.size!=im.size or ImageChops.difference(im,out.convert('RGBA')).getbbox(alpha_only=False):
                # WebP may normalize hidden RGB in transparent pixels; compare visible composites.
                with Image.open(dst) as decoded:
                    for bg in ('white','black'):
                        from PIL import ImageColor
                        base=Image.new('RGBA',im.size,ImageColor.getrgb(bg)+(255,))
                        if ImageChops.difference(Image.alpha_composite(base,im).convert('RGB'),Image.alpha_composite(base,decoded.convert('RGBA')).convert('RGB')).getbbox():
                            raise ValueError(f'Pixel mismatch: {dst.name}')
            records.append({'filename':dst.name,'width':im.width,'height':im.height,'bytes':dst.stat().st_size,'source_bytes':src.stat().st_size,'review_status':'blank' if blank else 'needs_review' if suspicious else 'pending_approval'})
assert len(records)==len(list(root.glob('*.png')))
(root/'inventory.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('Converted',len(records),'files; blank:',sum(r['review_status']=='blank' for r in records),'suspect:',sum(r['review_status']=='needs_review' for r in records))
