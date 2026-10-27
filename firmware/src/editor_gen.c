/* SPDX-License-Identifier: GPL-3.0-only */
/* The generative machine over the editor protocol (cmds 96..101; web/EDITOR_PROTOCOL.md "Generator"). Included by
 * editor.c after its framing helpers. A control page (web/control/) keeps itself in step with the device:
 *   96 GEN_INFO    -> version, id count (v14: GP_TRK + NPART x GK_N, 128), GP_TRK, GK_N, NPART, setup slots
 *   97 GEN_ALL     [start [, count]] -> start, count (v14), count x v14: the settings ids start.. (gen_setup.c gen_get);
 *                  no count, or 0: to the last id
 *   98 GEN_SET     id, v14 -> id, v14 (as it is after: actions such as SAVE answer 0). No push about it
 *   99 GEN_STATUS  -> 42 x v14: on, playing, root, scale, src, loop length, master chord, each track's chord, the scale's
 *                  mask (lo, hi bytes), each track's step, the loop (16), each track's density now, macro + 100, the
 *                  settings' version, saved slots, power-on, a save pending (felucca_web.c's web_gen_info, the same)
 *  100 GEN_CHANGED (push) id, v14: a setting changed on the device (its knobs and keys, MIDI CC, a pass mutating
 *                  nothing it shows), not by the page's own GEN_SET. Coalesced: each id at most every 20 ms
 *  101 GEN_RELOAD  (push) ver: the settings changed all at once on the device (power-on, RANDOM, DEFAULTS, LOAD):
 *                  read them again with GEN_ALL
 * The pushes go while the editor watches (WATCH, kept alive by any request: the page polls GEN_STATUS) */
enum { ED_GEN_INFO = 96, ED_GEN_ALL, ED_GEN_SET, ED_GEN_STATUS, ED_GEN_CHANGED, ED_GEN_RELOAD };
#define ED_GEN_VERSION 1u
#define ED_GEN_N (GP_TRK + NPART * GK_N)          /* 128 ids */
#define ED_GEN_STATUS_N 42u

static struct {
    int16_t v[ED_GEN_N];                         /* what the page knows */
    uint16_t t[ED_GEN_N];                        /* when each was pushed (ms, 16 bit) */
    uint8_t ver, pos, on;
} ed_gw;

/* the generator's live state (the page draws its chord strip, steps and meters from it) */
static void ed_gen_status_fill(uint8_t *b)
{
    uint32_t i, m = gen.llen ? gen_mask() : 0xAB5u;
    b[0] = gen.on;
    b[1] = (uint8_t)song.playing;
    b[2] = gen.root;
    b[3] = gen.scale;
    b[4] = gen.src;
    b[5] = gen.llen;
    b[6] = gen.cur_m;
    for (i = 0; i < 4u; i++)
        b[7 + i] = gen.cur_t[i];
    b[11] = (uint8_t)(m & 0xFFu);
    b[12] = (uint8_t)(m >> 8);
    for (i = 0; i < 4u; i++)
        b[13 + i] = (uint8_t)trk[i].seq_idx;
    for (i = 0; i < GEN_LOOP_MAX; i++)
        b[17 + i] = (uint8_t)gen.loop[i];
    for (i = 0; i < 4u; i++)
        b[33 + i] = (uint8_t)(gen.llen ? gen_dens(i, gen.pos[i]) : 0u);
    b[37] = (uint8_t)(gen.macro + 100);
    b[38] = gen.ver;
    b[39] = (uint8_t)gen_slots();
    b[40] = gen_store.boot;
#if FELUCCA_FLASH
    b[41] = (uint8_t)(gen_dirty || persist_pending);
#else
    b[41] = gen_dirty;
#endif
}

static void ed_gen_shadow(void)                  /* the page has read everything as it is */
{
    uint32_t i;
    for (i = 0; i < ED_GEN_N; i++)
        ed_gw.v[i] = (int16_t)gen_get(i);
    ed_gw.ver = gen.ver;
}

/* 1 = handled (the reply is in ed_out) */
static int ed_gen_handle(uint32_t cmd, const uint8_t *a, uint32_t na)
{
    uint32_t i;
    switch (cmd) {
    case ED_GEN_INFO:
        ed_b(ED_GEN_VERSION);
        ed_v(ED_GEN_N);
        ed_b(GP_TRK);
        ed_b(GK_N);
        ed_b(NPART);
        ed_b(GEN_NSLOT);
        return 1;
    case ED_GEN_ALL: {                           /* [start, count]: the settings, as gen_get has them */
        uint32_t start = na >= 1u ? a[0] : 0u, count = na >= 2u && a[1] ? a[1] : ED_GEN_N;
        if (start >= ED_GEN_N)
            start = ED_GEN_N;
        if (count > ED_GEN_N - start)
            count = ED_GEN_N - start;
        ed_b(start);
        ed_v((int32_t)count);
        for (i = start; i < start + count; i++) {
            int32_t v = gen_get(i);
            ed_v(v);
            ed_gw.v[i] = (int16_t)v;             /* known to the page now */
        }
        if (start == 0u && count == ED_GEN_N)
            ed_gw.ver = gen.ver;
        return 1;
    }
    case ED_GEN_SET: {
        uint32_t id;
        int32_t v;
        if (na < 3u || a[0] >= ED_GEN_N)
            return 0;                            /* (no reply) */
        id = a[0];
        v = ed_rv(a + 1);
        gen_set(id, v);
        ed_b(id);
        ed_v(gen_get(id));
        for (i = 0; i < ED_GEN_N; i++)           /* the page's own change (and what it set off: a track's sound, the */
            ed_gw.v[i] = (int16_t)gen_get(i);    /* loop of a new scale): no push. RANDOM / LOAD: a RELOAD is pushed */
        if (id != GP_RANDOM && id != GP_DEFAULTS && id != GP_LOAD)
            ed_gw.ver = gen.ver;
        return 1;
    }
    case ED_GEN_STATUS: {
        uint8_t b[ED_GEN_STATUS_N];
        ed_gen_status_fill(b);
        for (i = 0; i < ED_GEN_STATUS_N; i++)
            ed_v(b[i]);
        return 1;
    }
    default:
        return 0;
    }
}

static void ed_gen_off(void) { ed_gw.on = 0; }   /* watching ended: the next WATCH starts from the values as they are */

/* main loop, while watched (editor.c ed_sync): the device's own changes, pushed */
static void ed_gen_sync(uint32_t now, uint32_t *n)
{
    uint32_t i;
    if (!ed_gw.on) {                             /* watching started: from the settings as they are */
        ed_gen_shadow();
        ed_gw.on = 1;
    }
    if (gen.ver != ed_gw.ver) {                  /* all at once: the page reads them again */
        if (!ed_room())
            return;
        ed_gen_shadow();
        ed_begin(ED_GEN_RELOAD);
        ed_b(gen.ver & 0x7Fu);
        ed_send();
        (*n)++;
        return;
    }
    for (i = 0; i < ED_GEN_N && *n < ED_PUSH_MAX; i++) {
        uint32_t k = (ed_gw.pos + i) % ED_GEN_N;
        int16_t v;
        if (k == GP_PLAY || k == GP_REGEN || k == GP_RANDOM || k == GP_DEFAULTS || k == GP_SAVE || k == GP_LOAD ||
            k == GP_CLEAR)
            continue;                            /* actions, not settings (PLAY: GEN_STATUS) */
        v = (int16_t)gen_get(k);
        if (v == ed_gw.v[k] || (uint16_t)(now - ed_gw.t[k]) < 20u)
            continue;
        if (!ed_room())
            return;
        ed_gw.v[k] = v;
        ed_gw.t[k] = (uint16_t)now;
        ed_begin(ED_GEN_CHANGED);
        ed_b(k);
        ed_v(v);
        ed_send();
        (*n)++;
        ed_gw.pos = (uint8_t)(k + 1u);
    }
}
