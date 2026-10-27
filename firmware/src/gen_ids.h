/* SPDX-License-Identifier: GPL-3.0-only */
/* The generative machine's setting ids (gen.c, gen_setup.c gen_set / gen_get, the editor protocol's GEN_* commands,
 * the GEN pages: params.c). Globals 0..31, then GK_N per track from GP_TRK */
#pragma once

enum {
    GP_ON, GP_ROOT, GP_SCALE, GP_UMASK, GP_SRC, GP_PRESET, GP_PLEN, GP_RATE, GP_MUT, GP_COMBINE, GP_BPM, GP_PLAY,
    GP_REGEN, GP_MACRO, GP_DRIFT, GP_SWING, GP_RANDOM, GP_DEFAULTS,
    GP_SAVE, GP_LOAD, GP_BOOT, GP_CLEAR, GP_SLOTS, GP_PENDING,   /* setups (gen_setup.c): SAVE / LOAD / CLEAR n = 1..8,
                                                                 * BOOT 0 RANDOM 1 LAST 2.. SETUP 1..; SLOTS, PENDING: read */
    GP_TUNE,                                                     /* A = 432 or 440 (Hz) */
    GP_TRK = 32
};
enum { GK_MULT, GK_LOCK, GK_FREEZE, GK_OUT, GK_MODE, GK_RHY, GK_DENS, GK_OCT, GK_LEAP, GK_REST, GK_PATCH, GK_MUTE,
       GK_LEN, GK_DMSRC, GK_DMRATE, GK_DMDEPTH, GK_WEIGHT, GK_CHANCE, GK_DRIFT, GK_SWING, GK_N = 24 };
