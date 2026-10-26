/* SPDX-License-Identifier: GPL-3.0-only
 * The generative machine's settings (gen.c), from the main loop: switching it on sets the four tracks up
 * (FM6 on each, their patterns one bar of 1/16, QNT and CHRD off), and gen_set changes one setting by id
 * (gen.c GP_*, GP_TRK + 16 x track + GK_*). Included after ui.c (set_engine_of, apply_preset_to). */

static void gen_track_sound(uint32_t ti)
{
    track_t *t = &trk[ti];
    if (t->eng_req != ENGI_FM6)
        set_engine_of(t, ENGI_FM6);
    apply_preset_to(t, gen.tk[ti].patch % 8u);
    t->p[P_VOICE] = ti >= GT_BASS ? V_MONO : V_POLY;
}

static void gen_track_setup(uint32_t ti)
{
    track_t *t = &trk[ti];
    uint32_t i;
    gen_track_sound(ti);
    t->p[P_SLEN] = GEN_STEPS;
    t->p[P_SDIV] = 2;                    /* 1/16 */
    t->p[P_SGATE] = ti < GT_BASS ? 120 : ti == GT_BASS ? 96 : 100;
    t->p[P_QUANT] = QN_OFF;
    t->p[P_CHRD] = 0;
    t->p[P_AMODE] = 0;                   /* ARP off */
    t->p[P_LEVEL] = ti == GT_DYAD_B ? 88 : ti == GT_MEL ? 92 : 100;
    for (i = 0; i < NSTEP; i++) {
        memset(&t->step[i], 0, sizeof t->step[i]);
        t->step[i].time = ST_REST;
    }
    memset(gen.dec[ti], 0, sizeof gen.dec[ti]);
}

static void gen_enable(uint32_t on)
{
    uint32_t i;
    if (on && !gen.on) {
        if (!gen.llen)
            gen_defaults();
        for (i = 0; i < NPART; i++)
            gen_track_setup(i);
        gen.regen = 1;
    }
    gen.on = (uint8_t)(on != 0u);
}

static uint32_t gen_lim(int32_t v, int32_t lo, int32_t hi) { return (uint32_t)(v < lo ? lo : v > hi ? hi : v); }

static void gen_set(uint32_t id, int32_t v)
{
    if (!gen.llen)
        gen_defaults();
    if (id >= GP_TRK) {
        uint32_t ti = (id - GP_TRK) / GK_N, k = (id - GP_TRK) % GK_N;
        gen_trk_t *g;
        if (ti >= NPART)
            return;
        g = &gen.tk[ti];
        switch (k) {
        case GK_MULT: g->mult = (uint8_t)gen_lim(v, 0, GEN_NMULT - 1); break;
        case GK_LOCK: g->lock = (uint8_t)(v != 0); break;
        case GK_FREEZE: g->freeze = (uint8_t)(v != 0); break;
        case GK_OUT: g->out = (uint8_t)gen_lim(v, 0, 2); break;
        case GK_MODE: g->mode = (uint8_t)gen_lim(v, 0, 3); break;
        case GK_RHY: g->rhy = (uint8_t)gen_lim(v, 0, 3); break;
        case GK_DENS: g->dens = (uint8_t)gen_lim(v, 0, 100); break;
        case GK_OCT: g->oct = (int8_t)gen_lim(v + 2, 0, 4) - 2; break;
        case GK_LEAP: g->leap = (uint8_t)gen_lim(v, 0, 100); break;
        case GK_REST: g->rest = (uint8_t)gen_lim(v, 0, 100); break;
        case GK_PATCH:
            g->patch = (uint8_t)gen_lim(v, 0, 7);
            if (gen.on)
                gen_track_sound(ti);
            break;
        case GK_MUTE: g->mute = (uint8_t)(v != 0); break;
        default: break;
        }
        return;
    }
    switch (id) {
    case GP_ON: gen_enable((uint32_t)v); break;
    case GP_ROOT: gen.root = (uint8_t)gen_lim(v, 0, 11); break;
    case GP_SCALE: gen.scale = (uint8_t)gen_lim(v, 0, GEN_UMASK_SCALE); gen.regen = 1; break;
    case GP_UMASK: gen.umask = (uint16_t)(v & 0xFFF); if (gen.scale == GEN_UMASK_SCALE) gen.regen = 1; break;
    case GP_SRC: gen.src = (uint8_t)gen_lim(v, 0, GS_COUNT - 1); gen.regen = 1; break;
    case GP_PRESET: gen.preset = (uint8_t)gen_lim(v, 0, GEN_NPRESETS - 1); gen.regen = 1; break;
    case GP_PLEN: gen.plen = (uint8_t)gen_lim(v, 2, 8); gen.regen = 1; break;
    case GP_RATE: gen.rate = (uint8_t)gen_lim(v, 0, GEN_NRATE - 1); break;
    case GP_MUT: gen.mut = (uint8_t)gen_lim(v, 0, 100); break;
    case GP_COMBINE: gen.combine = (uint8_t)gen_lim(v, 0, 2); break;
    case GP_BPM: song.g[G_BPM] = (int16_t)gen_lim(v, 40, 240); break;
    case GP_PLAY: transport_req = v ? 1u : 2u; break;
    case GP_REGEN: gen.regen = 1; break;
    default: break;
    }
    if (!song.playing && gen.regen) {
        gen.regen = 0;
        gen_make_loop(0);                /* (stopped: no pass will draw it) */
    }
}
