"""Add looping Idle and Walk actions to an MPFB game-engine rig source file."""

from pathlib import Path
import sys

import bpy


ROOT = Path.home() / "Documents" / "Mall Virtual Blender"
FPS = 24


def pose_key(pose_bones, frame, rotations):
    for name, rotation in rotations.items():
        bone = pose_bones.get(name)
        if not bone:
            continue
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = rotation
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)


def build_idle(rig):
    action = bpy.data.actions.new("Idle")
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    bones = rig.pose.bones
    poses = {
        1: {"spine_02": (0.0, 0.0, 0.0), "spine_03": (0.0, 0.0, 0.0), "neck_01": (0.0, 0.0, 0.0)},
        25: {"spine_02": (0.018, 0.0, 0.0), "spine_03": (-0.012, 0.0, 0.0), "neck_01": (-0.006, 0.0, 0.0)},
        49: {"spine_02": (0.0, 0.0, 0.0), "spine_03": (0.0, 0.0, 0.0), "neck_01": (0.0, 0.0, 0.0)},
    }
    for frame, rotations in poses.items():
        pose_key(bones, frame, rotations)
    return action


def build_walk(rig):
    action = bpy.data.actions.new("Walk")
    action.use_fake_user = True
    rig.animation_data.action = action
    bones = rig.pose.bones
    # One complete cycle. The legs are opposite each other, as are the arms.
    poses = {
        1: {
            "thigh_l": (0.44, 0.0, 0.0), "calf_l": (-0.06, 0.0, 0.0), "foot_l": (-0.10, 0.0, 0.0),
            "thigh_r": (-0.44, 0.0, 0.0), "calf_r": (0.42, 0.0, 0.0), "foot_r": (0.18, 0.0, 0.0),
            "upperarm_l": (-0.40, 0.0, 0.03), "lowerarm_l": (-0.16, 0.0, 0.0),
            "upperarm_r": (0.40, 0.0, -0.03), "lowerarm_r": (-0.08, 0.0, 0.0),
            "spine_02": (-0.02, 0.0, 0.025), "spine_03": (0.0, 0.0, 0.018),
        },
        7: {
            "thigh_l": (0.0, 0.0, 0.0), "calf_l": (0.22, 0.0, 0.0), "foot_l": (0.08, 0.0, 0.0),
            "thigh_r": (0.0, 0.0, 0.0), "calf_r": (0.0, 0.0, 0.0), "foot_r": (0.0, 0.0, 0.0),
            "upperarm_l": (0.0, 0.0, 0.0), "lowerarm_l": (-0.12, 0.0, 0.0),
            "upperarm_r": (0.0, 0.0, 0.0), "lowerarm_r": (-0.12, 0.0, 0.0),
            "spine_02": (0.0, 0.0, 0.0), "spine_03": (0.0, 0.0, 0.0),
        },
        13: {
            "thigh_l": (-0.44, 0.0, 0.0), "calf_l": (0.42, 0.0, 0.0), "foot_l": (0.18, 0.0, 0.0),
            "thigh_r": (0.44, 0.0, 0.0), "calf_r": (-0.06, 0.0, 0.0), "foot_r": (-0.10, 0.0, 0.0),
            "upperarm_l": (0.40, 0.0, 0.03), "lowerarm_l": (-0.08, 0.0, 0.0),
            "upperarm_r": (-0.40, 0.0, -0.03), "lowerarm_r": (-0.16, 0.0, 0.0),
            "spine_02": (-0.02, 0.0, -0.025), "spine_03": (0.0, 0.0, -0.018),
        },
        19: {
            "thigh_l": (0.0, 0.0, 0.0), "calf_l": (0.0, 0.0, 0.0), "foot_l": (0.0, 0.0, 0.0),
            "thigh_r": (0.0, 0.0, 0.0), "calf_r": (0.22, 0.0, 0.0), "foot_r": (0.08, 0.0, 0.0),
            "upperarm_l": (0.0, 0.0, 0.0), "lowerarm_l": (-0.12, 0.0, 0.0),
            "upperarm_r": (0.0, 0.0, 0.0), "lowerarm_r": (-0.12, 0.0, 0.0),
            "spine_02": (0.0, 0.0, 0.0), "spine_03": (0.0, 0.0, 0.0),
        },
    }
    poses[25] = poses[1]
    for frame, rotations in poses.items():
        pose_key(bones, frame, rotations)
    return action


def main(source_name):
    source = ROOT / source_name
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    for action in list(bpy.data.actions):
        if action.name in {"Idle", "Walk"}:
            bpy.data.actions.remove(action)
    scene = bpy.context.scene
    scene.render.fps = FPS
    build_idle(rig)
    walk = build_walk(rig)
    rig.animation_data.action = walk
    scene.frame_start = 1
    scene.frame_end = 25
    scene["animation_notes"] = "Idle and Walk loop clips; locomotion stays controlled by the mall."
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    print(f"SAVED actions in {source}")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1])
