/* SPDX-License-Identifier: GPL-3.0-only
 * The generative machine's settings (gen.c), from the main loop: switching it on sets the four tracks up
 * (FM6 on each, their patterns one bar of 1/16, QNT and CHRD off), and gen_set changes one setting by id
 * (gen.c GP_*, GP_TRK + GK_N x track + GK_*), gen_get reads one back. Included after ui.c (set_engine_of, apply_preset_to). */

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
    t->p[P_SLEN] = (int16_t)gen_len(ti);
    t->p[P_SDIV] = 2;                    /* 1/16 */
    t->p[P_SGATE] = ti < GT_BASS ? 120 : ti == GT_BASS ? 96 : 100;
    t->p[P_QUANT] = QN_OFF;
    t->p[P_SQNT] = 0;                    /* QUANTIZE off: the steps' NUDGE plays (DRIFT, gen.c gen_drift) */
    t->p[P_SSWING] = gen.tk[ti].swing;
    t->p[P_CHRD] = 0;
    t->p[P_AMODE] = 0;                   /* ARP off */
    t->p[P_LEVEL] = ti == GT_DYAD_B ? 88 : ti == GT_MEL ? 92 : 100;
    if (gen.tk[ti].freeze) {             /* a frozen track keeps its pattern (from a setup: gen_restore put it
                                          * back); one with no notes in it is unfrozen, or it would never play */
        for (i = 0; i < gen_len(ti) && t->step[i].time != ST_NOTE; i++)
            ;
        if (i < gen_len(ti))
            return;
        gen.tk[ti].freeze = 0;
    }
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
    }                                    /* (the progression as it stands: drawn, or restored from a setup) */
    gen.on = (uint8_t)(on != 0u);
}

static uint32_t gen_lim(int32_t v, int32_t lo, int32_t hi) { return (uint32_t)(v < lo ? lo : v > hi ? hi : v); }

/* ---------------------------------------------------------------- random settings --- */
static uint32_t gen_pick(uint32_t n) { return n ? gen_rnd() % n : 0u; }
static uint32_t gen_from(const uint8_t *list, uint32_t n) { return list[gen_pick(n)]; }
#define GEN_FROM(a) gen_from(a, sizeof a)

/* a whole new setup, drawn from seed within ranges that suit each part: mostly 7-note scales, sounds that fit the
 * track's role, moderate densities, a little drift or swing now and then. The tracks' outputs (where the notes go)
 * stay as they are: they are the studio's wiring, not the music */
static void gen_randomize(uint32_t seed)
{
    static const uint8_t SCL[] = {1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 9, 8, 7, 5, 6};          /* MAJ MIN DOR MIX LYD PHR HARM PENs */
    static const uint8_t PLEN[] = {3, 4, 4, 4, 5, 6, 8};
    static const uint8_t RATE[] = {0, 1, 1, 2, 2, 2, 4, 4, 8};                          /* 1/2, 1, 2, 4, 8 bars */
    static const uint8_t COMB[] = {GC_INDEP, GC_INDEP, GC_INDEP, GC_MERGE, GC_CALL};
    static const uint8_t PDYAD[] = {0, 1, 3, 4, 4, 6};                                 /* TINE BELL BRASS PAD ORGAN */
    static const uint8_t PBASS[] = {2, 2, 2, 7, 5};                                    /* FM BASS, PLUCK, MARIMBA */
    static const uint8_t PMEL[] = {7, 7, 1, 5, 0, 3};                                  /* PLUCK BELL MARIMBA TINE BRASS */
    static const uint8_t MULT[] = {1, 2, 2, 3};                                        /* x1/2 x1 x1 x2 */
    static const uint8_t ODDLEN[] = {5, 6, 7, 8, 10, 12, 12, 14};
    uint32_t i;
    uint8_t out[NPART];
    for (i = 0; i < NPART; i++)
        out[i] = gen.tk[i].out;
    gen.seed = seed ? seed : 0x6D2B79F5u;
    gen_rnd();
    song.g[G_BPM] = (int16_t)(84 + gen_pick(37));
    song.g[G_SWING] = (int16_t)(gen_pick(2) ? gen_pick(31) : 0);
    gen.root = (uint8_t)gen_pick(12);
    gen.scale = (uint8_t)GEN_FROM(SCL);
    gen.src = (uint8_t)gen_pick(GS_COUNT);
    gen.preset = (uint8_t)gen_pick(GEN_NPRESETS);
    gen.plen = (uint8_t)GEN_FROM(PLEN);
    gen.rate = (uint8_t)GEN_FROM(RATE);
    gen.mut = (uint8_t)(5 + gen_pick(36));
    gen.combine = (uint8_t)GEN_FROM(COMB);
    gen.drift = (uint8_t)(gen_pick(3) ? 0 : 5 + gen_pick(16));
    gen.macro = 0;
    for (i = 0; i < NPART; i++) {
        gen_trk_t *g = &gen.tk[i];
        memset(g, 0, sizeof *g);
        g->out = out[i];
        g->len = (uint8_t)(gen_pick(4) ? 16u : GEN_FROM(ODDLEN));
        g->mult = (uint8_t)GEN_FROM(MULT);
        g->chance = (uint8_t)(gen_pick(3) ? 100u : 70u + gen_pick(31));
        g->drift = (uint8_t)(gen_pick(3) ? 0u : gen_pick(26));
        g->weight = (int8_t)(30 + gen_pick(71));
        if (gen_pick(2)) {                                   /* half the time the density moves by itself */
            g->dmsrc = (uint8_t)(1u + gen_pick(GDM_COUNT - 1u));
            g->dmrate = (uint8_t)(2u + gen_pick(5));         /* 1 .. 16 bars */
            g->dmdepth = (int8_t)((20 + (int32_t)gen_pick(41)) * (gen_pick(4) ? 1 : -1));
        } else {
            g->dmrate = 3;
        }
        switch (i) {
        case GT_DYAD_A:
        case GT_DYAD_B:
            g->patch = (uint8_t)GEN_FROM(PDYAD);
            g->mode = (uint8_t)gen_pick(4);
            g->rhy = (uint8_t)gen_pick(4);
            g->dens = (uint8_t)(25 + gen_pick(46));
            g->lock = (uint8_t)(gen_pick(4) == 0u);
            break;
        case GT_BASS:
            g->patch = (uint8_t)GEN_FROM(PBASS);
            g->mode = (uint8_t)gen_pick(4);
            g->dens = (uint8_t)(25 + gen_pick(51));
            g->lock = (uint8_t)(gen_pick(3) != 0u);         /* mostly on the master's chords */
            g->len = (uint8_t)(gen_pick(5) ? 16u : g->len);
            break;
        default:
            g->patch = (uint8_t)GEN_FROM(PMEL);
            g->mode = (uint8_t)gen_pick(3);
            g->dens = (uint8_t)(25 + gen_pick(46));
            g->leap = (uint8_t)(10 + gen_pick(41));
            g->rest = (uint8_t)(5 + gen_pick(36));
            break;
        }
    }
    gen_make_loop(0);
    gen.ver++;
}

/* back to the settings the manual lists (the outputs stay, as with RANDOM) */
static void gen_reset(void)
{
    uint32_t i;
    uint8_t out[NPART];
    for (i = 0; i < NPART; i++)
        out[i] = gen.tk[i].out;
    gen_defaults();
    for (i = 0; i < NPART; i++)
        gen.tk[i].out = out[i];
    song.g[G_BPM] = 120;
    song.g[G_SWING] = 0;
    gen.ver++;
}

/* after RANDOM / DEFAULTS while it is on: the tracks take their new sounds, lengths and swing (their patterns are
 * written anew from the next step) */
static void gen_apply_tracks(void)
{
    uint32_t i;
    if (!gen.on)
        return;
    for (i = 0; i < NPART; i++)
        gen_track_setup(i);
}

/* ------------------------------------------------------------------------- setups --- */
/* Saved in Felucca's settings record (project.c: persist_t, then this), both of its A/B copies, written only while
 * the transport is stopped (settings_poll). 8 setups, the last session (kept only while power-on is LAST), and what
 * power-on does. A setup is everything the generator plays from: its settings, the progression loop as it stands,
 * the custom scale, the tempo and global swing, the seed, and the patterns of its frozen tracks (a frozen phrase
 * comes back as it was) */
#define GEN_STORE_MAGIC 0x314E4547u              /* "GEN1" */
#define GEN_NSLOT 8u
enum { GBOOT_RANDOM, GBOOT_LAST, GBOOT_SLOT0 };
typedef struct {                                 /* a frozen track's pattern: per step its kind and velocity, two notes */
    uint8_t tv[GEN_STEPS];                       /* ST_* (2 bits) | velocity / 2 (6 bits) << 2 */
    uint8_t n0[GEN_STEPS], n1[GEN_STEPS];        /* the notes (0: none) */
} gen_pat_t;
typedef struct {
    uint8_t used, root, scale, src, preset, plen, rate, mut, combine, drift, swing, llen;
    int8_t macro, loop[GEN_LOOP_MAX];
    uint8_t rsv[3];
    uint16_t umask;
    int16_t bpm;
    uint32_t seed;
    gen_trk_t tk[NPART];
    gen_pat_t pat[NPART];                        /* (only a frozen track's is kept) */
} gen_setup_t;
typedef struct {
    uint32_t magic;
    uint16_t size, rsv0;
    uint8_t boot, rsv[3];                        /* GBOOT_*: RANDOM, LAST, SETUP n (GBOOT_SLOT0 + n) */
    gen_setup_t last, slot[GEN_NSLOT];
} gen_store_t;
static gen_store_t gen_store;
static uint8_t gen_dirty, gen_was_playing;       /* a change to write (gen_persist_poll); PLAY seen */
static uint32_t gen_dirty_ms;

static void gen_capture(gen_setup_t *s)
{
    uint32_t i;
    memset(s, 0, sizeof *s);
    s->used = 1;
    s->root = gen.root;
    s->scale = gen.scale;
    s->src = gen.src;
    s->preset = gen.preset;
    s->plen = gen.plen;
    s->rate = gen.rate;
    s->mut = gen.mut;
    s->combine = gen.combine;
    s->drift = gen.drift;
    s->swing = (uint8_t)song.g[G_SWING];
    s->llen = gen.llen;
    s->macro = gen.macro;
    for (i = 0; i < GEN_LOOP_MAX; i++)
        s->loop[i] = gen.loop[i];
    s->umask = gen.umask;
    s->bpm = song.g[G_BPM];
    s->seed = gen.seed;
    for (i = 0; i < NPART; i++) {
        uint32_t k;
        s->tk[i] = gen.tk[i];
        if (!gen.tk[i].freeze)
            continue;
        for (k = 0; k < GEN_STEPS; k++) {
            const step_t *st = &trk[i].step[k];
            s->pat[i].tv[k] = (uint8_t)((st->time & 3u) | ((st->vel >> 1) & 63u) << 2);
            s->pat[i].n0[k] = st->n ? st->note[0] : 0u;
            s->pat[i].n1[k] = st->n > 1u ? st->note[1] : 0u;
        }
    }
}
/* the generator plays from setup s (its tracks are set up by the caller: gen_enable or gen_apply_tracks); a frozen
 * track gets its saved pattern back */
static void gen_restore(const gen_setup_t *s)
{
    uint32_t i;
    gen.root = (uint8_t)(s->root % 12u);
    gen.scale = s->scale > GEN_UMASK_SCALE ? 1u : s->scale;
    gen.src = (uint8_t)(s->src % GS_COUNT);
    gen.preset = (uint8_t)(s->preset % GEN_NPRESETS);
    gen.plen = (uint8_t)gen_lim(s->plen, 2, 8);
    gen.rate = (uint8_t)(s->rate % GEN_NRATE);
    gen.mut = (uint8_t)gen_lim(s->mut, 0, 100);
    gen.combine = (uint8_t)(s->combine % 3u);
    gen.drift = (uint8_t)gen_lim(s->drift, 0, 100);
    song.g[G_SWING] = (int16_t)gen_lim(s->swing, 0, 100);
    gen.macro = s->macro;
    gen.umask = (uint16_t)(s->umask & 0xFFFu);
    song.g[G_BPM] = (int16_t)gen_lim(s->bpm, 40, 240);
    gen.seed = s->seed ? s->seed : 0x6D2B79F5u;
    for (i = 0; i < NPART; i++) {
        uint32_t k;
        gen.tk[i] = s->tk[i];
        if (!gen.tk[i].freeze)
            continue;
        for (k = 0; k < GEN_STEPS; k++) {
            step_t *st = &trk[i].step[k];
            uint32_t tv = s->pat[i].tv[k];
            memset(st, 0, sizeof *st);
            st->time = (uint8_t)((tv & 3u) <= ST_REST ? tv & 3u : ST_REST);
            if (st->time == ST_NOTE && s->pat[i].n0[k]) {
                st->note[0] = s->pat[i].n0[k];
                st->note[1] = s->pat[i].n1[k];
                st->n = (uint8_t)(s->pat[i].n1[k] ? 2u : 1u);
                st->vel = (uint8_t)((tv >> 2) << 1 | 1u);
                step_set_chance(st, gen.tk[i].chance);
            } else if (st->time == ST_NOTE) {
                st->time = ST_REST;
            }
        }
    }
    if (s->llen >= 2u && s->llen <= GEN_LOOP_MAX) {   /* the progression as it was, not a new one */
        for (i = 0; i < GEN_LOOP_MAX; i++)
            gen.loop[i] = (int8_t)gen_wrap_deg(s->loop[i]);
        gen.llen = s->llen;
    } else {
        gen_make_loop(0);
    }
    gen.regen = 0;
    gen.pass = 0;
    gen.ver++;
}
/* power-on (project.c persist_boot): the store from the settings record, or an empty one */
static void gen_store_import(const gen_store_t *g)
{
    if (g && g->magic == GEN_STORE_MAGIC && g->size == sizeof *g) {
        gen_store = *g;
        if (gen_store.boot >= GBOOT_SLOT0 + GEN_NSLOT)
            gen_store.boot = GBOOT_RANDOM;
    } else {
        memset(&gen_store, 0, sizeof gen_store);
    }
    gen_store.magic = GEN_STORE_MAGIC;
    gen_store.size = (uint16_t)sizeof gen_store;
}
/* before the settings record is written (project.c settings_poll): the last session, when power-on resumes it */
static void gen_store_export(void)
{
    if (gen_store.boot == GBOOT_LAST && gen.on && gen.llen)
        gen_capture(&gen_store.last);
}
static void gen_mark(void)
{
    gen_dirty = 1;
    gen_dirty_ms = fm1_ms;
}
static uint32_t gen_slots(void)
{
    uint32_t i, m = 0;
    for (i = 0; i < GEN_NSLOT; i++)
        m |= (uint32_t)(gen_store.slot[i].used != 0u) << i;
    return m;
}
/* main loop: a change (or, resuming, the end of a play) is written 1.5 s later, once the transport is stopped
 * (settings_save queues it; settings_poll writes it when nothing plays) */
static void gen_persist_poll(void)
{
    uint8_t playing = (uint8_t)(song.playing != 0u);
    if (gen_was_playing && !playing && gen_store.boot == GBOOT_LAST)
        gen_mark();
    gen_was_playing = playing;
    if (gen_dirty && (uint32_t)(fm1_ms - gen_dirty_ms) >= 1500u) {
        gen_dirty = 0;
        settings_save();
    }
}

/* a setting by id (gen_set's), as it is now */
static int32_t gen_get(uint32_t id)
{
    if (!gen.llen)
        gen_defaults();
    if (id >= GP_TRK) {
        uint32_t ti = (id - GP_TRK) / GK_N, k = (id - GP_TRK) % GK_N;
        const gen_trk_t *g;
        if (ti >= NPART)
            return 0;
        g = &gen.tk[ti];
        switch (k) {
        case GK_MULT: return g->mult;
        case GK_LOCK: return g->lock;
        case GK_FREEZE: return g->freeze;
        case GK_OUT: return g->out;
        case GK_MODE: return g->mode;
        case GK_RHY: return g->rhy;
        case GK_DENS: return g->dens;
        case GK_OCT: return g->oct;
        case GK_LEAP: return g->leap;
        case GK_REST: return g->rest;
        case GK_PATCH: return g->patch;
        case GK_MUTE: return g->mute;
        case GK_LEN: return gen_len(ti);
        case GK_DMSRC: return g->dmsrc;
        case GK_DMRATE: return g->dmrate;
        case GK_DMDEPTH: return g->dmdepth;
        case GK_WEIGHT: return g->weight;
        case GK_CHANCE: return g->chance;
        case GK_DRIFT: return g->drift;
        case GK_SWING: return g->swing;
        default: return 0;
        }
    }
    switch (id) {
    case GP_ON: return gen.on;
    case GP_ROOT: return gen.root;
    case GP_SCALE: return gen.scale;
    case GP_UMASK: return gen.umask;
    case GP_SRC: return gen.src;
    case GP_PRESET: return gen.preset;
    case GP_PLEN: return gen.plen;
    case GP_RATE: return gen.rate;
    case GP_MUT: return gen.mut;
    case GP_COMBINE: return gen.combine;
    case GP_BPM: return song.g[G_BPM];
    case GP_PLAY: return song.playing;
    case GP_MACRO: return gen.macro;
    case GP_DRIFT: return gen.drift;
    case GP_SWING: return song.g[G_SWING];
    case GP_BOOT: return gen_store.boot;
    case GP_SLOTS: return (int32_t)gen_slots();
    case GP_PENDING: return gen_dirty;
    default: return 0;
    }
}

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
        case GK_DMSRC: g->dmsrc = (uint8_t)gen_lim(v, 0, GDM_COUNT - 1); break;
        case GK_DMRATE: g->dmrate = (uint8_t)gen_lim(v, 0, GEN_NDMRATE - 1); break;
        case GK_DMDEPTH: g->dmdepth = (int8_t)((int32_t)gen_lim(v + 100, 0, 200) - 100); break;
        case GK_WEIGHT: g->weight = (int8_t)((int32_t)gen_lim(v + 100, 0, 200) - 100); break;
        case GK_CHANCE: g->chance = (uint8_t)gen_lim(v, 1, 100); break;
        case GK_DRIFT: g->drift = (uint8_t)gen_lim(v, 0, 100); break;
        case GK_SWING:
            g->swing = (uint8_t)gen_lim(v, 0, 100);
            if (gen.on)
                trk[ti].p[P_SSWING] = (int16_t)g->swing;
            break;
        case GK_LEN:
            g->len = (uint8_t)gen_lim(v, 1, GEN_STEPS);
            if (gen.on)
                trk[ti].p[P_SLEN] = (int16_t)g->len;
            break;
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
    case GP_DRIFT: gen.drift = (uint8_t)gen_lim(v, 0, 100); break;
    case GP_SWING: song.g[G_SWING] = (int16_t)gen_lim(v, 0, 100); break;
    case GP_MACRO: gen.macro = (int8_t)((int32_t)gen_lim(v + 100, 0, 200) - 100); break;
    case GP_RANDOM:
        gen_randomize(gen_rnd() ^ (uint32_t)v ^ fm1_ticks());
        gen_apply_tracks();
        gen.regen = 1;
        break;
    case GP_DEFAULTS:
        gen_reset();
        gen_apply_tracks();
        gen.regen = 1;
        break;
    case GP_SAVE:                                 /* SAVE n: the setup as it is now into slot n (1..8) */
        if (v >= 1 && v <= (int32_t)GEN_NSLOT) {
            gen_capture(&gen_store.slot[v - 1]);
            gen_mark();
        }
        break;
    case GP_LOAD:                                 /* LOAD n: play from slot n, if it holds a setup */
        if (v >= 1 && v <= (int32_t)GEN_NSLOT && gen_store.slot[v - 1].used) {
            gen_restore(&gen_store.slot[v - 1]);
            gen_apply_tracks();
        }
        break;
    case GP_CLEAR:
        if (v >= 1 && v <= (int32_t)GEN_NSLOT) {
            memset(&gen_store.slot[v - 1], 0, sizeof gen_store.slot[v - 1]);
            if (gen_store.boot == GBOOT_SLOT0 + (uint32_t)v - 1u)
                gen_store.boot = GBOOT_RANDOM;   /* (power-on cannot start from an empty slot) */
            gen_mark();
        }
        break;
    case GP_BOOT:                                 /* what power-on does: RANDOM, LAST, SETUP n */
        gen_store.boot = (uint8_t)gen_lim(v, 0, GBOOT_SLOT0 + GEN_NSLOT - 1);
        if (gen_store.boot >= GBOOT_SLOT0 && !gen_store.slot[gen_store.boot - GBOOT_SLOT0].used)
            gen_store.boot = GBOOT_RANDOM;
        gen_mark();
        break;
    default: break;
    }
    if (gen_store.boot == GBOOT_LAST && id < GP_SAVE)
        gen_mark();                               /* resuming: every change is kept (written once stopped) */
    if (!song.playing && gen.regen) {
        gen.regen = 0;
        gen_make_loop(0);                /* (stopped: no pass will draw it) */
    }
}

/* power-on (main.c, after the last session's music is restored): the generator starts on, its tracks set up and
 * waiting for PLAY, as the store says: a new random setup (GEN_BOOT_RANDOM=0: the defaults), the last session, or
 * a saved setup. GEN_BOOT_ON=0 builds a firmware
 * that starts as plain Felucca */
#ifndef GEN_BOOT_ON
#define GEN_BOOT_ON 1
#endif
#ifndef GEN_BOOT_RANDOM
#define GEN_BOOT_RANDOM 1
#endif
/* a seed that differs from one power-on to the next: the word below (RAM's own state at power-on, kept and stirred
 * across resets), the timer, and the low bits of the battery and MASTER readings (their noise); the browser build
 * adds the page's own random number (gen_web_seed) */
static int32_t fm1_adc_read(uint32_t ch);          /* (hal/fm1_adc.h; the browser build's comes later) */
static uint32_t gen_noinit __attribute__((section(".noinit")));
static uint32_t gen_web_seed;
static uint32_t gen_entropy(void)
{
    uint32_t h = gen_noinit ^ gen_web_seed ^ fm1_ticks() * 0x9E3779B1u, i;
    for (i = 0; i < 16u; i++) {
        int32_t a = fm1_adc_read(i & 1u ? 4u : 3u);     /* MASTER, the battery (hal/fm1_adc.h FM1_ADC_*) */
        h = (h ^ (uint32_t)a ^ fm1_ticks()) * 0x01000193u;
        h ^= h >> 15;
    }
    gen_noinit = h * 0x85EBCA77u + 0x632BE59Bu;      /* (a reset without power-off still moves on) */
    return h ? h : 1u;
}
static void gen_boot(void)
{
    if (!GEN_BOOT_ON)
        return;
    gen_defaults();
    if (gen_store.boot == GBOOT_LAST && gen_store.last.used)
        gen_restore(&gen_store.last);          /* where the last session left off */
    else if (gen_store.boot >= GBOOT_SLOT0 && gen_store.slot[gen_store.boot - GBOOT_SLOT0].used)
        gen_restore(&gen_store.slot[gen_store.boot - GBOOT_SLOT0]);
    else if (GEN_BOOT_RANDOM)
        gen_randomize(gen_entropy());
    gen.ver++;
    gen_enable(1);
}

