"""Create display-only square card images. Never modify originals or gallery images."""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops
import re,json
root=Path(__file__).resolve().parents[1]/'images'
dest=root/'cards'
dest.mkdir(exist_ok=True)
report=[]
for src in sorted(root.glob('*.webp')):
    if not re.fullmatch(r'\d+(?:-\d+)?',src.stem):
        continue
    with Image.open(src) as original:
        rgba=ImageOps.exif_transpose(original).convert('RGBA')
        im=Image.new('RGB',rgba.size,'white')
        im.paste(rgba,mask=rgba.getchannel('A'))
        # Conservative near-white edge trim: preserve pale objects, fine details and shadows.
        diff=ImageChops.difference(im,Image.new('RGB',im.size,'white'))
        r,g,b=diff.split()
        mask=ImageChops.lighter(ImageChops.lighter(r,g),b).point(lambda p:255 if p>7 else 0)
        bbox=mask.getbbox()
        if bbox is None:
            raise ValueError(f'Blank cover {src.name}')
        w,h=im.size
        # Only trim on predominantly white outer edges. Keep a generous safety margin.
        edge=mask.crop((0,0,w,max(1,h//40)))
        white_edges=sum(mask.crop(box).histogram()[255] for box in [(0,0,w,max(1,h//40)),(0,h-max(1,h//40),w,h),(0,0,max(1,w//40),h),(w-max(1,w//40),0,w,h)])
        edge_area=2*w*max(1,h//40)+2*h*max(1,w//40)
        if white_edges/edge_area<0.04:
            margin=round(max(w,h)*0.035)
            x0,y0,x1,y1=bbox
            crop=(max(0,x0-margin),max(0,y0-margin),min(w,x1+margin),min(h,y1+margin))
        else:
            crop=(0,0,w,h)
        product=im.crop(crop)
        product.thumbnail((460,460),Image.Resampling.LANCZOS)
        # Enlarge only cropped content, never stretch or cut it.
        if max(product.size)<460:
            ratio=460/max(product.size)
            product=product.resize(tuple(round(n*ratio) for n in product.size),Image.Resampling.LANCZOS)
        canvas=Image.new('RGB',(512,512),'white')
        canvas.paste(product,((512-product.width)//2,(512-product.height)//2))
        out=dest/src.name
        canvas.save(out,'WEBP',quality=94,method=6)
        with Image.open(out) as check:
            check.load()
            assert check.size==(512,512) and check.format=='WEBP'
        report.append({'filename':src.name,'crop':list(crop),'source_size':[w,h],'output_size':[512,512],'bytes':out.stat().st_size})
assert len(report)==45, len(report)
(dest/'inventory.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'Validated {len(report)} square card images.')
