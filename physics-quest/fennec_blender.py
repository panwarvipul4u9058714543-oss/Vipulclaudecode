"""
Fennec Fox — 3D Blender Character
Duolingo-style toon render with bounce animation
"""
import bpy
import math
import mathutils

# ── Clean slate ───────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=True)
for col in bpy.data.collections:
    bpy.data.collections.remove(col)

# ══════════════════════════════════════════════════════════
# MATERIALS  (Toon / Cel-shaded look)
# ══════════════════════════════════════════════════════════
def toon_mat(name, base_col, shadow_col=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    if shadow_col is None:
        # darken base for shadow
        shadow_col = tuple(max(0, c - 0.18) for c in base_col[:3]) + (1.0,)

    out   = nt.nodes.new('ShaderNodeOutputMaterial')
    mix   = nt.nodes.new('ShaderNodeMixShader')
    diff  = nt.nodes.new('ShaderNodeBsdfDiffuse')
    emit  = nt.nodes.new('ShaderNodeEmission')
    s2rgb = nt.nodes.new('ShaderNodeShaderToRGB')
    ramp  = nt.nodes.new('ShaderNodeValToRGB')
    geo   = nt.nodes.new('ShaderNodeNewGeometry')

    # Toon ramp: 2 sharp steps
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position  = 0.0
    ramp.color_ramp.elements[0].color     = (*shadow_col[:3], 1)
    ramp.color_ramp.elements[1].position  = 0.45
    ramp.color_ramp.elements[1].color     = (*base_col[:3], 1)

    diff.inputs['Color'].default_value = (*base_col[:3], 1)
    emit.inputs['Color'].default_value = (*base_col[:3], 1)
    emit.inputs['Strength'].default_value = 0.15

    nt.links.new(diff.outputs['BSDF'],  s2rgb.inputs['Shader'])
    nt.links.new(s2rgb.outputs['Color'],ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], emit.inputs['Color'])
    # Blend toon diffuse with slight emission
    nt.links.new(diff.outputs['BSDF'],  mix.inputs[1])
    nt.links.new(emit.outputs['Emission'], mix.inputs[2])
    mix.inputs['Fac'].default_value = 0.08
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

    # Actually simplify to just principled for EEVEE speed
    nt.nodes.clear()
    out2   = nt.nodes.new('ShaderNodeOutputMaterial')
    pbsdf  = nt.nodes.new('ShaderNodeBsdfPrincipled')
    pbsdf.inputs['Base Color'].default_value   = (*base_col[:3], 1)
    pbsdf.inputs['Roughness'].default_value    = 0.85
    pbsdf.inputs['Specular IOR Level'].default_value = 0.1
    nt.links.new(pbsdf.outputs['BSDF'], out2.inputs['Surface'])
    return mat

def glossy_mat(name, col):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out  = nt.nodes.new('ShaderNodeOutputMaterial')
    pbsdf= nt.nodes.new('ShaderNodeBsdfPrincipled')
    pbsdf.inputs['Base Color'].default_value  = (*col[:3], 1)
    pbsdf.inputs['Roughness'].default_value   = 0.05
    pbsdf.inputs['Specular IOR Level'].default_value = 1.0
    nt.links.new(pbsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

# Colour palette
FUR    = (1.00, 0.95, 0.82, 1)
INNER  = (1.00, 0.70, 0.75, 1)
DARK   = (0.04, 0.02, 0.01, 1)
WHITE  = (1.00, 1.00, 1.00, 1)
BLUE   = (0.10, 0.60, 0.95, 1)
YELL   = (1.00, 0.85, 0.10, 1)

m_fur   = toon_mat('Fur',   FUR)
m_inner = toon_mat('Inner', INNER)
m_dark  = toon_mat('Dark',  DARK)
m_white = toon_mat('White', WHITE)
m_blue  = toon_mat('Blue',  BLUE)
m_eye   = glossy_mat('Eye', DARK)
m_shine = glossy_mat('Shine', WHITE)

# ══════════════════════════════════════════════════════════
# HELPER: add object with material + subsurf
# ══════════════════════════════════════════════════════════
def add_subd(obj, lv=2):
    mod = obj.modifiers.new('Subd', 'SUBSURF')
    mod.levels        = lv
    mod.render_levels = lv
    mod.use_limit_surface = True

def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)

# ══════════════════════════════════════════════════════════
# BUILD CHARACTER
# ══════════════════════════════════════════════════════════

# ── HEAD ──────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=1.0,
                                     location=(0, 0, 1.7))
head = bpy.context.object
head.name = 'Head'
head.scale = (1.0, 0.87, 1.0)
bpy.ops.object.transform_apply(scale=True)
assign(head, m_fur)
add_subd(head)

# ── EARS — very large, fennec style ───────────────────────
def make_ear(side):
    sign = -1 if side == 'L' else 1

    # Outer ear shell
    bpy.ops.mesh.primitive_cone_add(
        vertices=3, radius1=0.72, radius2=0.04, depth=2.4,
        location=(sign * 0.68, -0.05, 3.35))
    ear = bpy.context.object
    ear.name = f'Ear{side}'
    ear.rotation_euler = (0.12, sign * 0.22, sign * 0.10)
    ear.scale = (0.82, 0.28, 1.0)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    assign(ear, m_fur)
    add_subd(ear, 3)

    # Inner ear (pink)
    bpy.ops.mesh.primitive_cone_add(
        vertices=3, radius1=0.50, radius2=0.02, depth=2.0,
        location=(sign * 0.68, -0.22, 3.38))
    inner = bpy.context.object
    inner.name = f'InnerEar{side}'
    inner.rotation_euler = (0.12, sign * 0.22, sign * 0.10)
    inner.scale = (0.70, 0.18, 0.95)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    assign(inner, m_inner)
    add_subd(inner, 3)
    return ear, inner

ear_l, inner_l = make_ear('L')
ear_r, inner_r = make_ear('R')

# ── SNOUT ─────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=0.38,
                                     location=(0, -0.90, 1.55))
snout = bpy.context.object
snout.name = 'Snout'
snout.scale = (1.1, 1.0, 0.82)
bpy.ops.object.transform_apply(scale=True)
assign(snout, m_fur)
add_subd(snout)

# ── NOSE ──────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.11,
                                     location=(0, -1.22, 1.60))
nose = bpy.context.object
nose.name = 'Nose'
nose.scale = (1.3, 0.85, 0.88)
bpy.ops.object.transform_apply(scale=True)
assign(nose, m_dark)

# ── EYES (per side) ───────────────────────────────────────
def make_eye(side):
    sign = -1 if side == 'L' else 1
    cx = sign * 0.46

    # Eye white
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.22,
                                          location=(cx, -0.88, 1.82))
    ew = bpy.context.object; ew.name = f'EyeWhite{side}'
    assign(ew, m_white)

    # Iris (dark)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.17,
                                          location=(cx, -0.99, 1.82))
    iris = bpy.context.object; iris.name = f'Iris{side}'
    assign(iris, m_eye)

    # Shine highlight
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.062,
                                          location=(cx - sign*0.06, -1.06, 1.92))
    sh = bpy.context.object; sh.name = f'Shine{side}'
    assign(sh, m_shine)

make_eye('L')
make_eye('R')

# ── BODY ──────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=20, radius=1.0,
                                     location=(0, 0, 0.1))
body = bpy.context.object
body.name = 'Body'
body.scale = (1.0, 0.88, 1.15)
bpy.ops.object.transform_apply(scale=True)
assign(body, m_fur)
add_subd(body)

# Belly patch (lighter)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.62,
                                     location=(0, -0.72, 0.12))
belly = bpy.context.object
belly.name = 'Belly'
belly.scale = (0.85, 0.32, 0.95)
bpy.ops.object.transform_apply(scale=True)
assign(belly, m_white)
add_subd(belly)

# ── ARMS / PAWS ───────────────────────────────────────────
def make_arm(side):
    sign = -1 if side == 'L' else 1
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.38,
                                          location=(sign * 0.95, -0.32, 0.02))
    arm = bpy.context.object; arm.name = f'Arm{side}'
    arm.scale = (0.9, 0.7, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    assign(arm, m_fur); add_subd(arm, 1)

    # Paw
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.25,
                                          location=(sign * 1.22, -0.55, -0.18))
    paw = bpy.context.object; paw.name = f'Paw{side}'
    paw.scale = (1.1, 0.85, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    assign(paw, m_fur); add_subd(paw, 1)
    return arm, paw

arm_l, paw_l = make_arm('L')
arm_r, paw_r = make_arm('R')

# ── LEGS / FEET ───────────────────────────────────────────
for side in ['L', 'R']:
    sign = -1 if side == 'L' else 1
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.35,
                                          location=(sign * 0.52, 0.12, -0.85))
    leg = bpy.context.object; leg.name = f'Leg{side}'
    leg.scale = (0.85, 0.8, 1.1)
    bpy.ops.object.transform_apply(scale=True)
    assign(leg, m_fur); add_subd(leg, 1)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.32,
                                          location=(sign * 0.52, -0.52, -1.22))
    foot = bpy.context.object; foot.name = f'Foot{side}'
    foot.scale = (0.9, 1.55, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    assign(foot, m_fur); add_subd(foot, 1)

# ── TAIL ──────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.55,
                                     location=(0, 0.95, -0.65))
tail = bpy.context.object; tail.name = 'Tail'
tail.scale = (0.75, 1.6, 0.62)
bpy.ops.object.transform_apply(scale=True)
assign(tail, m_fur); add_subd(tail, 1)

bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.32,
                                     location=(0, 1.52, -0.72))
tip = bpy.context.object; tip.name = 'TailTip'
tip.scale = (0.85, 0.95, 0.75)
bpy.ops.object.transform_apply(scale=True)
assign(tip, m_white); add_subd(tip, 1)

# ── BOOK (prop) ───────────────────────────────────────────
bpy.ops.mesh.primitive_cube_add(size=0.58, location=(0, -0.85, 0.20))
book = bpy.context.object; book.name = 'Book'
book.scale = (0.9, 0.18, 0.72)
bpy.ops.object.transform_apply(scale=True)
assign(book, m_blue)

bpy.ops.mesh.primitive_cube_add(size=0.56, location=(0, -0.88, 0.20))
cover = bpy.context.object; cover.name = 'BookCover'
cover.scale = (0.88, 0.06, 0.70)
bpy.ops.object.transform_apply(scale=True)
assign(cover, toon_mat('DarkBlue', (0.05, 0.35, 0.72, 1)))

# ══════════════════════════════════════════════════════════
# PARENT ALL TO ROOT EMPTY
# ══════════════════════════════════════════════════════════
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
root = bpy.context.object; root.name = 'FoxRoot'

for obj in bpy.data.objects:
    if obj.name not in ('FoxRoot', 'Camera', 'Light', 'Sun',
                        'KeyLight', 'FillLight', 'RimLight'):
        obj.parent = root

# ══════════════════════════════════════════════════════════
# LIGHTING  — three-point rig
# ══════════════════════════════════════════════════════════
# Key light (warm, bright)
bpy.ops.object.light_add(type='AREA', location=(3.0, -4.0, 5.0))
key = bpy.context.object; key.name = 'KeyLight'
key.data.energy = 800
key.data.color  = (1.0, 0.94, 0.82)
key.data.size   = 4.0
key.rotation_euler = (math.radians(55), 0, math.radians(35))

# Fill light (cool, softer)
bpy.ops.object.light_add(type='AREA', location=(-4.0, -2.5, 2.5))
fill = bpy.context.object; fill.name = 'FillLight'
fill.data.energy = 280
fill.data.color  = (0.72, 0.84, 1.0)
fill.data.size   = 6.0

# Rim / back light
bpy.ops.object.light_add(type='SPOT', location=(0, 5.0, 4.0))
rim = bpy.context.object; rim.name = 'RimLight'
rim.data.energy = 350
rim.data.color  = (1.0, 0.90, 0.72)
rim.rotation_euler = (math.radians(-30), 0, 0)
rim.data.spot_size  = math.radians(60)
rim.data.spot_blend = 0.3

# ── World / background ────────────────────────────────────
world = bpy.context.scene.world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value    = (0.06, 0.07, 0.14, 1)
bg.inputs['Strength'].default_value = 0.6

# ══════════════════════════════════════════════════════════
# CAMERA
# ══════════════════════════════════════════════════════════
bpy.ops.object.camera_add(location=(0.0, -6.2, 1.4))
cam = bpy.context.object; cam.name = 'Camera'
cam.rotation_euler = (math.radians(88), 0, 0)
cam.data.lens = 80         # portrait telephoto
bpy.context.scene.camera = cam

# ══════════════════════════════════════════════════════════
# ANIMATION — idle bounce + ear wiggle (60 frames = 2s loop)
# ══════════════════════════════════════════════════════════
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end   = 60

def insert_loc(obj, frame, loc):
    scene.frame_set(frame)
    obj.location = loc
    obj.keyframe_insert(data_path='location')

def insert_rot(obj, frame, rot):
    scene.frame_set(frame)
    obj.rotation_euler = rot
    obj.keyframe_insert(data_path='rotation_euler')

# Root bounce (up / down)
keyframes_bounce = [
    (1,  (0, 0, 0.00)),
    (8,  (0, 0, 0.08)),
    (15, (0, 0, 0.22)),
    (22, (0, 0, 0.28)),
    (30, (0, 0, 0.22)),
    (38, (0, 0, 0.08)),
    (45, (0, 0, 0.00)),
    (52, (0, 0,-0.05)),
    (60, (0, 0, 0.00)),
]
for fr, loc in keyframes_bounce:
    insert_loc(root, fr, loc)

# Slight head tilt
for fr, ry in [(1,0.0),(15,0.05),(30,0.0),(45,-0.04),(60,0.0)]:
    insert_rot(head, fr, (0, ry, 0))

# Ear wiggle — left ear
for fr, rx, ry in [
    (1,  0.12,  0.22),
    (10, 0.18,  0.28),
    (20, 0.08,  0.18),
    (30, 0.20,  0.30),
    (40, 0.10,  0.20),
    (50, 0.16,  0.26),
    (60, 0.12,  0.22),
]:
    insert_rot(ear_l, fr, (rx, -0.22, -0.10))

# Ear wiggle — right ear (offset)
for fr, rx, ry in [
    (1,  0.12, -0.22),
    (10, 0.10, -0.18),
    (20, 0.20, -0.30),
    (30, 0.10, -0.20),
    (40, 0.18, -0.28),
    (50, 0.10, -0.18),
    (60, 0.12, -0.22),
]:
    insert_rot(ear_r, fr, (rx, ry, 0.10))

# Smooth all FCurves
for obj in [root, head, ear_l, ear_r]:
    if obj.animation_data and obj.animation_data.action:
        for fc in obj.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
            fc.update()

# ══════════════════════════════════════════════════════════
# RENDER SETTINGS  (EEVEE — fast, great quality)
# ══════════════════════════════════════════════════════════
scene.render.engine               = 'BLENDER_EEVEE'
scene.render.resolution_x         = 720
scene.render.resolution_y         = 900
scene.render.resolution_percentage= 100
scene.render.fps                  = 30
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format        = 'MPEG4'
scene.render.ffmpeg.codec         = 'H264'
scene.render.ffmpeg.constant_rate_factor = 'HIGH'
scene.render.filepath = '/home/user/Vipulclaudecode/physics-quest/fennec_3d.mp4'

# EEVEE quality
eevee = scene.eevee
eevee.taa_render_samples  = 64
eevee.use_bloom           = True
eevee.bloom_intensity     = 0.06
eevee.use_ssr             = True
eevee.use_soft_shadows    = True

# Freestyle outlines (toon look)
scene.render.use_freestyle = True
scene.render.line_thickness = 1.8
fl = scene.view_layers[0]
fl.use_freestyle = True
ls = fl.freestyle_settings.linesets[0]
ls.linestyle.color      = (0.08, 0.04, 0.02)
ls.linestyle.thickness  = 2.2
ls.linestyle.alpha      = 0.88

print("=" * 50)
print("Fox scene built. Rendering 60-frame animation...")
print("Output:", scene.render.filepath)
print("=" * 50)

bpy.ops.render.render(animation=True)
print("DONE!")
