"""Add a loopable walk action to the editable mall avatar and export a test GLB."""

from pathlib import Path
import math

import bpy
from mathutils import Quaternion


BLEND_PATH = Path.home() / "Documents" / "Mall Virtual Blender" / "mall-avatar-source.blend"
EXPORT_PATH = Path.home() / "Documents" / "Mall Virtual Blender" / "exports" / "mall-avatar-walk-source-v2.glb"
FRAME_RATE = 24
LAST_FRAME = 49


def keyframe_base_pose(armature, base_pose, frame):
    for pose_bone in armature.pose.bones:
        rotation, location, scale = base_pose[pose_bone.name]
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.rotation_quaternion = rotation
        pose_bone.location = location
        pose_bone.scale = scale
        pose_bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        pose_bone.keyframe_insert(data_path="location", frame=frame)
        pose_bone.keyframe_insert(data_path="scale", frame=frame)


def pose_rotation(pose_bone, base_rotation, frame, axis, angle):
    pose_bone.rotation_mode = "QUATERNION"
    pose_bone.rotation_quaternion = base_rotation @ Quaternion(axis, angle)
    pose_bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)


def walk_pose(armature, base_pose, frame, left_leg_forward):
    keyframe_base_pose(armature, base_pose, frame)
    direction = 1.0 if left_leg_forward else -1.0
    def rotate(name, axis, degrees):
        pose_rotation(armature.pose.bones[name], base_pose[name][0], frame, axis, math.radians(degrees))

    # Legs rotate around their lateral local axis. Arms use their local Z axis,
    # which produces a forward/back swing on this rig rather than a T-pose.
    rotate("Hips", (1, 0, 0), 1.5 * direction)
    rotate("Spine", (1, 0, 0), -0.8 * direction)
    rotate("LeftUpLeg", (1, 0, 0), 22.0 * direction)
    rotate("RightUpLeg", (1, 0, 0), -22.0 * direction)
    rotate("LeftLeg", (1, 0, 0), -8.0 if left_leg_forward else 28.0)
    rotate("RightLeg", (1, 0, 0), 28.0 if left_leg_forward else -8.0)
    rotate("LeftFoot", (1, 0, 0), -6.0 if left_leg_forward else 8.0)
    rotate("RightFoot", (1, 0, 0), 8.0 if left_leg_forward else -6.0)
    rotate("LeftArm", (0, 0, 1), 28.0 * direction)
    rotate("RightArm", (0, 0, 1), 28.0 * direction)
    rotate("LeftForeArm", (0, 0, 1), 9.0 * direction)
    rotate("RightForeArm", (0, 0, 1), 9.0 * direction)


bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
scene = bpy.context.scene
armature = next(obj for obj in scene.objects if obj.type == "ARMATURE")
idle_action = bpy.data.actions.get("IdleV4.2(maya_head)")
if not idle_action:
    raise RuntimeError("The imported avatar must retain its Idle action.")

armature.animation_data_create()
armature.animation_data.action = idle_action
scene.frame_set(1)
bpy.context.view_layer.update()
base_pose = {
    pose_bone.name: (
        pose_bone.rotation_quaternion.copy(),
        pose_bone.location.copy(),
        pose_bone.scale.copy(),
    )
    for pose_bone in armature.pose.bones
}

existing = bpy.data.actions.get("Walk")
if existing:
    bpy.data.actions.remove(existing, do_unlink=True)

action = bpy.data.actions.new("Walk")
armature.animation_data.action = action

walk_pose(armature, base_pose, 1, True)
walk_pose(armature, base_pose, 13, False)
walk_pose(armature, base_pose, 25, True)
walk_pose(armature, base_pose, 37, False)
walk_pose(armature, base_pose, LAST_FRAME, True)

scene.render.fps = FRAME_RATE
scene.frame_start = 1
scene.frame_end = LAST_FRAME
scene.frame_set(1)

# Save both the working animation and an isolated runtime test artifact.
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(EXPORT_PATH),
    export_format="GLB",
    export_animations=True,
    export_force_sampling=True,
    export_frame_range=True,
)
print(f"Created walk action and exported: {EXPORT_PATH}")
