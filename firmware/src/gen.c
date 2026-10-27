/* SPDX-License-Identifier: GPL-3.0-only
 * Generative chord and melody machine (proof of concept). Included by seq.c after its scale helpers; runs in
 * the audio ISR with the sequencer.
 *
 * Four tracks: 1 and 2 two-note chords (dyads), 3 a mono bass, 4 a mono melody. One harmony brain holds the
 * key (ROOT), the scale (a 12-bit mask: a built-in one or the user's), and a loop of chords (scale degrees)
 * made by one of the progression sources. The loop advances at the MASTER rate (1/2 bar .. 32 bars); each
 * track walks the same loop at the master rate times its own multiplier (x1/4 .. x8), or follows the master
 * chord exactly with LOCK on. Tracks drift apart and meet again where their periods line up.
 *
 * The generators write each track's 16-step pattern one step ahead of the playhead (gen_on_step, called by
 * seq_tick as a step starts): the sequencer plays what they wrote, so the step screen shows the live pattern.
 * Each step keeps a decision (a random word, and for the melody its offset); MUTATION is the chance, per step
 * and per pass, that it is drawn again. At 0 a track repeats its bar, re-voiced onto each new chord; FREEZE
 * stops a track's writing altogether, so its pattern loops as it stands.
 * Generated notes go to the track's synth, to USB MIDI OUT on the track's channel (trk_midi_ch), or both. */

#define GEN_STEPS 16u                    /* the longest pattern: one bar of 1/16 (LEN 1..16 per track) */
#define GEN_LOOP_MAX 16u                 /* chords in the progression loop (PENDULUM doubles it) */

enum { GS_FIXED, GS_WALK, GS_MARKOV, GS_FUNC, GS_CIRCLE, GS_VLEAD, GS_PEND, GS_PEDAL, GS_COUNT };
enum { GT_DYAD_A, GT_DYAD_B, GT_BASS, GT_MEL };
enum { GC_INDEP, GC_MERGE, GC_CALL };                          /* how dyad B relates to dyad A */
enum { GD_3RD, GD_5TH, GD_6TH, GD_AUTO };                      /* dyad intervals */
enum { GY_SUST, GY_PULSE, GY_ARP, GY_EUCL };                   /* dyad rhythms */
enum { GB_ROOT, GB_R5, GB_WALK, GB_OCT };                      /* bass patterns */
enum { GM_CHORD, GM_SCALE, GM_PASS };                          /* melody note pools */
enum { GO_BOTH, GO_INT, GO_MIDI };                             /* output */

/* parameter ids (web_gen / the UI): globals, then 16 per track from GP_TRK */
enum {
    GP_ON, GP_ROOT, GP_SCALE, GP_UMASK, GP_SRC, GP_PRESET, GP_PLEN, GP_RATE, GP_MUT, GP_COMBINE, GP_BPM, GP_PLAY,
    GP_REGEN, GP_MACRO, GP_DRIFT, GP_SWING, GP_RANDOM, GP_DEFAULTS,
    GP_SAVE, GP_LOAD, GP_BOOT, GP_CLEAR, GP_SLOTS, GP_PENDING,   /* setups (gen_setup.c): SAVE / LOAD / CLEAR n = 1..8,
                                                                 * BOOT 0 RANDOM 1 LAST 2.. SETUP 1..; SLOTS, PENDING: read */
    GP_TRK = 32
};
enum { GK_MULT, GK_LOCK, GK_FREEZE, GK_OUT, GK_MODE, GK_RHY, GK_DENS, GK_OCT, GK_LEAP, GK_REST, GK_PATCH, GK_MUTE,
       GK_LEN, GK_DMSRC, GK_DMRATE, GK_DMDEPTH, GK_WEIGHT, GK_CHANCE, GK_DRIFT, GK_SWING, GK_N = 24 };

/* the master rate: steps (1/16) per chord, 1/2 bar .. 32 bars, odd lengths too */
static const uint16_t GEN_RATE[] = {8, 16, 32, 48, 64, 80, 96, 112, 128, 192, 256, 384, 512};
#define GEN_NRATE (sizeof GEN_RATE / sizeof GEN_RATE[0])
/* per-track multipliers of the master period: x1/4 x1/2 x1 x2 x3 x4 x8 (num / den) */
static const uint8_t GEN_MNUM[] = {1, 1, 1, 2, 3, 4, 8}, GEN_MDEN[] = {4, 2, 1, 1, 1, 1, 1};
#define GEN_NMULT 7u

/* DENSITY's modulation: shapes, and periods in steps (1/4 bar .. 32 bars) */
enum { GDM_OFF, GDM_SINE, GDM_TRI, GDM_UP, GDM_DOWN, GDM_SQUARE, GDM_RAND, GDM_DRIFT, GDM_COUNT };
static const uint16_t GEN_DMRATE[] = {4, 8, 16, 32, 64, 128, 256, 512};
#define GEN_NDMRATE (sizeof GEN_DMRATE / sizeof GEN_DMRATE[0])

/* FIXED / PENDULUM progressions, scale degrees from 0 (I) */
static const int8_t GEN_PRESETS[][4] = {
    {0, 4, 5, 3},   /* I  V  vi IV */
    {1, 4, 0, 0},   /* ii V  I  I  */
    {5, 3, 0, 4},   /* vi IV I  V  */
    {0, 5, 3, 4},   /* I  vi IV V  */
    {0, 6, 5, 6},   /* i  VII VI VII (natural minor) */
    {0, 3, 0, 4},   /* I  IV I  V  */
};
#define GEN_NPRESETS (sizeof GEN_PRESETS / sizeof GEN_PRESETS[0])

/* MARKOV: weights of the next degree after each degree (7-note scales; others walk) */
static const uint8_t GEN_MARKOV[7][7] = {
    /*       I  ii iii IV  V  vi vii */
    /* I */ {0, 14, 6, 26, 28, 20, 6},
    /* ii*/ {6, 0, 4, 10, 54, 14, 12},
    /* iii*/{8, 6, 0, 24, 10, 46, 6},
    /* IV */{30, 12, 6, 0, 34, 10, 8},
    /* V */ {56, 4, 6, 10, 0, 22, 2},
    /* vi */{10, 26, 8, 34, 18, 0, 4},
    /* vii*/{62, 4, 14, 4, 8, 8, 0},
};

typedef struct {
    uint32_t r;          /* the step's random word */
    int8_t off;          /* melody: its offset in the pool from the chord root */
    uint8_t ok;          /* drawn (0: draw it the first time it is written) */
} gen_dec_t;

typedef struct {
    uint8_t mult, lock, freeze, out, mode, rhy, dens, leap, rest, patch, mute;
    int8_t oct;
    uint8_t len;         /* steps in the pattern, 1..16 (the tracks may differ: polymeter) */
    uint8_t dmsrc, dmrate;               /* DENSITY's modulation: its shape (GDM_*) and its period (GEN_DMRATE) */
    int8_t dmdepth;                      /* how far it moves DENSITY, -100..100 (negative: upside down) */
    int8_t weight;                       /* how far the MACRO moves this track's DENSITY, -100..100 */
    uint8_t chance;                      /* each note it writes plays at this chance, 1..100 % (the sequencer rolls) */
    uint8_t drift;                       /* how far its notes may land off the grid, 0..100 (+ the global DRIFT) */
    uint8_t swing;                       /* its own SWING, 0..100 (Felucca's P_SSWING; + the global one) */
} gen_trk_t;

static struct {
    volatile uint8_t on;
    uint8_t root, scale, src, preset, plen, rate, mut, combine;
    uint16_t umask;                      /* the user's scale (SCALE = the last value) */
    gen_trk_t tk[NPART];
    int8_t loop[GEN_LOOP_MAX];           /* the progression: scale degrees */
    uint8_t llen;                        /* chords in it (PENDULUM: up and back) */
    uint32_t pass;                       /* passes of the master over the loop, the last one drawn */
    uint32_t pos[NPART];                 /* each track's step count since PLAY (the step being written + 0) */
    gen_dec_t dec[NPART][GEN_STEPS];
    int8_t last_dy[2][2];                /* the dyads' last two degrees (AUTO's voice leading) */
    uint32_t seed;
    volatile uint8_t regen;              /* the UI asks for a new loop */
    volatile int8_t macro;               /* the MACRO knob, -100..100: every track's DENSITY by its WEIGHT */
    uint8_t drift;                       /* DRIFT for every track, 0..100, added to each track's own */
    volatile uint8_t ver;                /* + 1 whenever the settings change all at once (RANDOM, DEFAULTS, power-on) */
    /* what plays now, for the screen / the page */
    volatile uint8_t cur_m, cur_t[NPART];
} gen;

#define GEN_UMASK_SCALE 16u              /* SCALE index 16 = the user's mask */

static uint32_t gen_rnd(void)
{
    uint32_t s = gen.seed ? gen.seed : 0x2545F491u;
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    gen.seed = s;
    return s;
}
static uint32_t gen_pct(uint32_t pct) { return gen_rnd() % 100u < pct; }

static uint32_t gen_mask(void)
{
    uint32_t m = gen.scale >= GEN_UMASK_SCALE ? gen.umask : SCALE_MASK[gen.scale % (sizeof SCALE_MASK / sizeof SCALE_MASK[0])];
    return (m & 0xFFFu) | 1u;            /* the root is always in */
}
/* the scale's pitch classes above the root, ascending -> how many */
static uint32_t gen_pcs(uint8_t *pc)
{
    uint32_t m = gen_mask(), n = 0, i;
    for (i = 0; i < 12u; i++)
        if ((m >> i) & 1u)
            pc[n++] = (uint8_t)i;
    return n;
}
/* scale degree d (any integer) in octave oct (MIDI octave: 4 = middle C's) -> MIDI note */
static int32_t gen_deg_note(int32_t d, int32_t oct)
{
    uint8_t pc[12];
    int32_t n = (int32_t)gen_pcs(pc), q = d >= 0 ? d / n : -((-d + n - 1) / n), r = d - q * n;
    return 12 * (oct + 1 + q) + (int32_t)gen.root + pc[r];
}
static int32_t gen_wrap_deg(int32_t d)
{
    uint8_t pc[12];
    int32_t n = (int32_t)gen_pcs(pc);
    return ((d % n) + n) % n;
}
static int32_t gen_clamp_note(int32_t x, int32_t lo, int32_t hi)
{
    while (x < lo)
        x += 12;
    while (x > hi)
        x -= 12;
    return x;
}

/* ------------------------------------------------------------- the harmony brain --- */
static int32_t gen_next(int32_t prev, uint32_t i)
{
    uint8_t pc[12];
    uint32_t n = gen_pcs(pc), r = gen_rnd();
    switch (gen.src) {
    case GS_MARKOV:
        if (n == 7u) {
            uint32_t k, sum = 0, row = (uint32_t)gen_wrap_deg(prev);
            uint32_t x = r % 100u;
            for (k = 0; k < 7u; k++) {
                sum += GEN_MARKOV[row][k];
                if (x < sum)
                    return (int32_t)k;
            }
            return 0;
        }
        /* fall through: the walk */
    case GS_WALK:
    case GS_PEDAL: {
        int32_t step = (int32_t)(r % 2u) + 1;
        return gen_wrap_deg(prev + ((r >> 8) & 1u ? step : -step));
    }
    case GS_FUNC: {                      /* tonic, predominant, dominant, around */
        static const int8_t T[3] = {0, 5, 2}, PD[2] = {1, 3}, D[2] = {4, 6};
        if (n != 7u)
            return gen_wrap_deg(prev + 3);
        switch (i % 3u) {
        case 0: return i ? T[r % 3u] : 0;
        case 1: return PD[r % 2u];
        default: return D[(r >> 4) % 4u ? 0 : 1];
        }
    }
    case GS_CIRCLE:                      /* down a fifth: up a fourth = 3 degrees of a 7-note scale */
        return gen_wrap_deg(prev + (int32_t)(n == 7u ? 3u : n / 2u + 1u));
    case GS_VLEAD:                       /* two common tones: a third away */
        return gen_wrap_deg(prev + ((r >> 3) & 1u ? 2 : -2));
    default:
        return gen_wrap_deg(GEN_PRESETS[gen.preset % GEN_NPRESETS][i % 4u]);
    }
}

/* a new loop, or (keep) the same one with each chord drawn again at MUTATION */
static void gen_make_loop(int keep)
{
    uint32_t i, n = gen.plen < 2u ? 2u : gen.plen > 8u ? 8u : gen.plen;
    if (gen.src == GS_FIXED || gen.src == GS_PEND) {
        int8_t base[8];
        for (i = 0; i < n; i++) {
            base[i] = (int8_t)gen_wrap_deg(GEN_PRESETS[gen.preset % GEN_NPRESETS][i % 4u]);
            if (keep && gen_pct(gen.mut / 3u))   /* a fixed progression mutates gently: a chord a third away */
                base[i] = (int8_t)gen_wrap_deg(base[i] + (gen_rnd() & 1u ? 2 : -2));
        }
        for (i = 0; i < n; i++)
            gen.loop[i] = base[i];
        gen.llen = (uint8_t)n;
        if (gen.src == GS_PEND && n > 2u) {      /* up and back: 1 2 3 4 3 2 */
            for (i = 1; i + 1u < n; i++)
                gen.loop[n - 1u + i] = base[n - 1u - i];
            gen.llen = (uint8_t)(2u * n - 2u);
        }
        return;
    }
    if (!keep) {
        gen.loop[0] = 0;
        for (i = 1; i < n; i++)
            gen.loop[i] = (int8_t)gen_next(gen.loop[i - 1u], i);
    } else {
        for (i = 0; i < n; i++)
            if (gen_pct(gen.mut))
                gen.loop[i] = (int8_t)(i ? gen_next(gen.loop[i - 1u], i) : gen_next(gen.loop[n - 1u], 0));
    }
    gen.llen = (uint8_t)n;
}

static uint32_t gen_master_period(void) { return GEN_RATE[gen.rate % GEN_NRATE]; }
static uint32_t gen_trk_period(uint32_t ti)
{
    uint32_t m = gen.tk[ti].mult % GEN_NMULT, p = gen_master_period() * GEN_MNUM[m] / GEN_MDEN[m];
    return p < 4u ? 4u : p;
}
static uint32_t gen_lock(uint32_t ti) { return gen.tk[ti].lock; }
/* the loop index track ti plays at step s, and whether its chord changes there */
static uint32_t gen_chord_at(uint32_t ti, uint32_t s, uint32_t *change)
{
    uint32_t p = gen_lock(ti) ? gen_master_period() : gen_trk_period(ti);
    if (change)
        *change = s % p == 0u;
    return (s / p) % (gen.llen ? gen.llen : 1u);
}

/* ------------------------------------------------------------- density's modulation --- */
/* a value -256..256 for period k of track ti: the same every time (a hash, no state), so a song plays back alike */
static int32_t gen_hash(uint32_t ti, uint32_t k)
{
    uint32_t h = (k + 1u) * 0x9E3779B1u ^ (ti + 1u) * 0x85EBCA77u;
    h ^= h >> 15;
    h *= 0x2C1B3C6Du;
    h ^= h >> 12;
    return (int32_t)(h % 513u) - 256;
}
/* the shape at step s: -256..256, synced to PLAY */
static int32_t gen_dm_shape(uint32_t ti, uint32_t s)
{
    const gen_trk_t *k = &gen.tk[ti];
    uint32_t p = GEN_DMRATE[k->dmrate % GEN_NDMRATE], q = s / p;
    int32_t x = (int32_t)((s % p) * 1024u / p);                /* the phase, 0..1023 */
    switch (k->dmsrc) {
    case GDM_SINE: {                                           /* two parabolas: within 6 % of a sine */
        int32_t h = x & 511, y = h * (512 - h) / 256;          /* 0..256..0 over half a cycle */
        return x < 512 ? y : -y;
    }
    case GDM_TRI: return x < 512 ? -256 + x : 256 - (x - 512);
    case GDM_UP: return -256 + x / 2;
    case GDM_DOWN: return 256 - x / 2;
    case GDM_SQUARE: return x < 512 ? 256 : -256;
    case GDM_RAND: return gen_hash(ti, q);
    case GDM_DRIFT: {                                          /* random, glided from one value to the next */
        int32_t a = gen_hash(ti, q), b = gen_hash(ti, q + 1u);
        return a + (b - a) * x / 1024;
    }
    default: return 0;
    }
}
/* track ti's DENSITY at step s, 0..100: the setting moved by its modulation */
static uint32_t gen_dens(uint32_t ti, uint32_t s)
{
    const gen_trk_t *k = &gen.tk[ti];
    int32_t d = k->dens + (int32_t)k->weight * gen.macro / 100;
    if (k->dmsrc && k->dmdepth)
        d += (int32_t)k->dmdepth * gen_dm_shape(ti, s) / 256;
    return (uint32_t)(d < 0 ? 0 : d > 100 ? 100 : d);
}

/* --------------------------------------------------------------------- writing --- */
static uint32_t gen_len(uint32_t ti) { uint32_t n = gen.tk[ti].len; return n < 1u ? 1u : n > GEN_STEPS ? GEN_STEPS : n; }
static uint32_t gen_idx;                 /* the pattern step being written (gen_write) */
/* the step of track ti's pattern that plays at step s: from where its sequencer is now */
static uint32_t gen_idx_at(uint32_t ti, uint32_t s)
{
    uint32_t n = gen_len(ti);
    int32_t d = (int32_t)s - (int32_t)gen.pos[ti];
    return (uint32_t)(((int32_t)(trk[ti].seq_idx % n) + d % (int32_t)n + 2 * (int32_t)n) % (int32_t)n);
}
static void gen_put(step_t *st, const int32_t *notes, uint32_t n, uint32_t time, uint32_t vel)
{
    uint32_t i;
    memset(st, 0, sizeof *st);
    st->time = (uint8_t)time;
    if (time == ST_NOTE) {
        for (i = 0; i < n && i < 4u; i++)
            st->note[i] = (uint8_t)clamp(notes[i], 0, 127);
        st->n = (uint8_t)(n < 4u ? n : 4u);
        st->vel = (uint8_t)clamp((int32_t)vel, 1, 127);
    }
}

/* a dyad track's hits (1 = a new chord here, 0 = no new notes: a tie or a rest, *tie says which) */
static uint32_t gen_dyad_hit(uint32_t ti, uint32_t s, uint32_t idx, uint32_t *tie)
{
    const gen_trk_t *k = &gen.tk[ti];
    uint32_t change, d = gen_dens(ti, s), hit, n = gen_len(ti);
    const gen_dec_t *dc = &gen.dec[ti][idx];
    (void)gen_chord_at(ti, s, &change);
    *tie = 0;
    switch (k->rhy) {
    case GY_SUST:
        hit = change || idx == 0u || (d >= 60u && idx % 8u == 0u) || (d >= 85u && idx % 4u == 0u);
        *tie = !hit;
        return hit;
    case GY_PULSE: {
        uint32_t every = d < 30u ? 8u : d < 70u ? 4u : 2u;
        hit = change || idx % every == 0u;
        break;
    }
    case GY_ARP: {
        uint32_t every = d < 40u ? 4u : d < 80u ? 2u : 1u;
        hit = change || idx % every == 0u;
        break;
    }
    default: {                           /* EUCLID: k of 16, rotated by the track */
        uint32_t kk = 1u + d * (n - 1u) / 100u, i = (idx + 2u * n - ti * 2u) % n;
        hit = change || (i * kk) % n < kk;
        break;
    }
    }
    if (!change && dc->ok && (dc->r % 100u) < gen.mut / 4u)   /* MUTATION nudges the rhythm a little */
        hit = !hit;
    return hit;
}

/* the two degrees a dyad plays on chord c */
static void gen_dyad_degs(uint32_t ti, int32_t c, uint32_t r, int32_t *a, int32_t *b)
{
    uint32_t mode = gen.tk[ti].mode;
    if (gen.combine == GC_MERGE && ti == GT_DYAD_B) {          /* the upper half of A's chord: 5th and 7th */
        *a = c + 4;
        *b = c + 6;
        return;
    }
    if (gen.combine == GC_MERGE && ti == GT_DYAD_A)
        mode = GD_3RD;
    switch (mode) {
    case GD_5TH: *a = c; *b = c + 4; return;
    case GD_6TH: *a = c + 2; *b = c + 7; return;
    case GD_AUTO: {                      /* the pair of chord tones nearest the last one (voice leading) */
        static const int8_t P[3][2] = {{0, 2}, {2, 4}, {4, 7}};
        int32_t best = 0, bd = 0x7FFFFFFF, i;
        for (i = 0; i < 3; i++) {
            int32_t x = c + P[i][0], y = c + P[i][1];
            int32_t dd = (x - gen.last_dy[ti][0]) * (x - gen.last_dy[ti][0]) + (y - gen.last_dy[ti][1]) * (y - gen.last_dy[ti][1]);
            dd += (int32_t)(r % 3u);     /* a little randomness on ties */
            if (dd < bd) {
                bd = dd;
                best = i;
            }
        }
        *a = c + P[best][0];
        *b = c + P[best][1];
        return;
    }
    default: *a = c; *b = c + 2; return;
    }
}

static void gen_write_dyad(track_t *t, uint32_t ti, uint32_t s)
{
    gen_trk_t *k = &gen.tk[ti];
    uint32_t idx = gen_idx, tie, hit, r = gen.dec[ti][idx].r;
    int32_t c = gen.loop[gen_chord_at(ti, s, 0)], a, b, oct = 4 + k->oct, nn[2];
    step_t *st = &t->step[idx];
    if (gen.combine == GC_MERGE && ti == GT_DYAD_B) {          /* B moves with A */
        hit = gen_dyad_hit(GT_DYAD_A, s, gen_idx_at(GT_DYAD_A, s), &tie);
        c = gen.loop[gen_chord_at(GT_DYAD_A, s, 0)];
    } else if (gen.combine == GC_CALL && ti == GT_DYAD_B) {    /* B answers: plays where A does not */
        uint32_t ta, ha = gen_dyad_hit(GT_DYAD_A, s, gen_idx_at(GT_DYAD_A, s), &ta), tb;
        hit = !ha && !ta && gen_dyad_hit(ti, s, idx, &tb);
        tie = 0;
    } else {
        hit = gen_dyad_hit(ti, s, idx, &tie);
    }
    if (!hit) {
        gen_put(st, 0, 0, tie || k->rhy == GY_SUST ? ST_TIE : ST_REST, 0);
        return;
    }
    gen_dyad_degs(ti, c, r, &a, &b);
    gen.last_dy[ti][0] = (int8_t)a;
    gen.last_dy[ti][1] = (int8_t)b;
    nn[0] = gen_clamp_note(gen_deg_note(a, oct), 48, 84);
    nn[1] = gen_deg_note(b, oct);
    while (nn[1] <= nn[0])
        nn[1] += 12;
    while (nn[1] - nn[0] > 19)
        nn[1] -= 12;
    if (k->rhy == GY_ARP) {                                    /* one tone at a time, up and down */
        uint32_t d = gen_dens(ti, s);
        int32_t one = ((s / (d < 40u ? 4u : d < 80u ? 2u : 1u)) & 1u) ? nn[1] : nn[0];
        gen_put(st, &one, 1, ST_NOTE, idx % 4u ? 84u : 104u);
        return;
    }
    gen_put(st, nn, 2, ST_NOTE, (idx % 4u ? 80u : 100u) + (r >> 24) % 12u);
}

static void gen_write_bass(track_t *t, uint32_t s)
{
    gen_trk_t *k = &gen.tk[GT_BASS];
    uint32_t idx = gen_idx, change, r = gen.dec[GT_BASS][idx].r, ci = gen_chord_at(GT_BASS, s, &change);
    uint32_t dn = gen_dens(GT_BASS, s), n = gen_len(GT_BASS), kk = (2u + dn * 10u / 100u) * n / 16u, i = idx, hit, p;
    int32_t c = gen.src == GS_PEDAL ? 0 : gen.loop[ci], d = c, oct = 2 + k->oct, x;
    step_t *st = &t->step[idx];
    kk = kk ? kk : 1u;
    hit = change || idx == 0u || (i * kk) % n < kk;
    if (!change && (r % 100u) < gen.mut / 4u)
        hit = !hit;
    if (!hit) {
        gen_put(st, 0, 0, dn < 35u ? ST_TIE : ST_REST, 0);
        return;
    }
    switch (k->mode) {
    case GB_R5:
        d = (r >> 8) & 1u && !change ? c + 4 : c;
        break;
    case GB_OCT:
        d = c;
        oct += (r >> 8) & 1u && !change ? 1 : 0;
        break;
    case GB_WALK:
        p = gen_lock(GT_BASS) ? gen_master_period() : gen_trk_period(GT_BASS);
        if (gen.src != GS_PEDAL && (s + 1u) % p >= p - 2u) {   /* the last hits before a change approach it */
            int32_t nx = gen.loop[(ci + 1u) % (gen.llen ? gen.llen : 1u)];
            d = nx + ((r >> 9) & 1u ? 1 : -1);
        } else {
            static const int8_t W[4] = {0, 2, 4, 2};
            d = change ? c : c + W[(r >> 8) % 4u];
        }
        break;
    default:
        break;
    }
    x = gen_clamp_note(gen_deg_note(d, oct), 28, 55);
    gen_put(st, &x, 1, ST_NOTE, idx % 4u ? 92u : 112u);
}

static int32_t gen_mel_deg(int32_t c, int32_t off, uint32_t pool, uint32_t strong)
{
    uint8_t pc[12];
    int32_t n = (int32_t)gen_pcs(pc);
    if (pool == GM_CHORD || (pool == GM_PASS && strong)) {     /* chord tones: 3 per octave */
        int32_t q = off >= 0 ? off / 3 : -((-off + 2) / 3), r = off - q * 3;
        return c + 2 * r + q * n;
    }
    return c + off;
}

static void gen_write_mel(track_t *t, uint32_t s)
{
    gen_trk_t *k = &gen.tk[GT_MEL];
    uint32_t idx = gen_idx, change;
    gen_dec_t *dc = &gen.dec[GT_MEL][idx];
    int32_t c = gen.loop[gen_chord_at(GT_MEL, s, &change)], x;
    uint32_t r = dc->r, strong = idx % 4u == 0u, dens = gen_dens(GT_MEL, s) + (strong ? 20u : 0u);
    step_t *st = &t->step[idx];
    if ((r % 100u) >= dens || ((r >> 7) % 100u) < k->rest) {
        gen_put(st, 0, 0, ((r >> 14) % 100u) < k->rest ? ST_REST : ST_TIE, 0);
        return;
    }
    x = gen_deg_note(gen_mel_deg(c, dc->off, k->mode, strong), 5 + k->oct);
    x = gen_clamp_note(x, 62, 96);
    gen_put(st, &x, 1, ST_NOTE, strong ? 104u : 78u + (r >> 24) % 20u);
}

/* a decision drawn again (or the first time): the melody walks from the step before */
static void gen_draw(uint32_t ti, uint32_t idx)
{
    gen_dec_t *dc = &gen.dec[ti][idx];
    dc->r = gen_rnd();
    if (ti == GT_MEL) {
        const gen_dec_t *pv = &gen.dec[ti][(idx + gen_len(ti) - 1u) % gen_len(ti)];
        int32_t o = pv->ok ? pv->off : 3, mv;
        uint32_t r = gen_rnd();
        if (r % 100u < gen.tk[ti].leap)
            mv = (int32_t)(2u + (r >> 8) % 3u);                /* a leap: 2..4 */
        else
            mv = (r >> 8) % 3u ? 1 : 0;                        /* a step (2 in 3), or the same */
        if ((r >> 16) & 1u)
            mv = -mv;
        o += mv;
        if (o < -2 || o > 9)
            o -= 2 * mv;
        dc->off = (int8_t)o;
    }
    dc->ok = 1;
}

/* DRIFT: a note step lands off the grid by a new random amount each time it is written, early or late, most often
 * near the grid (the difference of two even draws). In Felucca's NUDGE: 1/16 of a step, -7..+7 at DRIFT 100 (the
 * track's QUANTIZE is off, gen_setup.c). A one-step pattern drifts late only (its next step is itself, written as
 * it starts: too late to play early) */
static void gen_drift(uint32_t ti, step_t *st)
{
    uint32_t a = gen.tk[ti].drift + gen.drift, m;
    int32_t off;
    a = a > 100u ? 100u : a;
    m = (a * 7u + 50u) / 100u;
    if (st->time != ST_NOTE || !m) {
        step_set_nudge(st, 0);
        return;
    }
    off = (int32_t)(gen_rnd() % (m + 1u)) - (int32_t)(gen_rnd() % (m + 1u));
    if (gen_len(ti) == 1u && off < 0)
        off = -off;
    step_set_nudge(st, off);
}

/* step s of track ti into step idx of its pattern */
static void gen_write(track_t *t, uint32_t ti, uint32_t s, uint32_t idx)
{
    gen_dec_t *dc = &gen.dec[ti][idx];
    step_t *st = &t->step[idx];
    gen_idx = idx;
    if (gen.tk[ti].freeze) {             /* the pattern stays; CHANCE and DRIFT still apply to its notes */
        if (st->time == ST_NOTE)
            step_set_chance(st, gen.tk[ti].chance);
        gen_drift(ti, st);
        return;
    }
    if (!dc->ok || gen_pct(gen.mut))
        gen_draw(ti, idx);
    switch (ti) {
    case GT_DYAD_A:
    case GT_DYAD_B: gen_write_dyad(t, ti, s); break;
    case GT_BASS: gen_write_bass(t, s); break;
    default: gen_write_mel(t, s); break;
    }
    if (gen.tk[ti].mute && st->time == ST_NOTE)
        gen_put(st, 0, 0, ST_REST, 0);
    if (st->time == ST_NOTE)
        step_set_chance(st, gen.tk[ti].chance);   /* (100: always, as the steps the sequencer had) */
    gen_drift(ti, st);
}

/* the master's pass over the loop: a new pass mutates it (written steps ahead see the new chords) */
static void gen_pass(uint32_t s)
{
    uint32_t p = gen.llen ? gen_master_period() * gen.llen : 1u, pass = s / p;
    if (gen.regen) {
        gen.regen = 0;
        gen_make_loop(0);
        gen.pass = pass;
        return;
    }
    if (pass != gen.pass) {
        gen.pass = pass;
        if (gen.mut)
            gen_make_loop(1);
    }
}

/* seq_tick: track t entered step idx (top: from PLAY). Writes the step after it (the sequencer looks one
 * step ahead for ties), and at the top this one too */
static void gen_on_step(track_t *t, uint32_t top, uint32_t len)
{
    uint32_t ti = (uint32_t)(t - trk), s, idx = t->seq_idx;
    if (!gen.on || ti >= NPART)
        return;
    len = len ? len : 1u;
    if (top) {
        gen.pos[ti] = 0;
        if (ti == 0u) {
            gen.pass = 0;
            gen_pass(0);
        }
    } else {
        gen.pos[ti]++;
    }
    s = gen.pos[ti];
    if (len == 1u) {                     /* one step: it is this one and the next (written now, as it plays) */
        gen_pass(s);
        gen_write(t, ti, s, 0);
    } else {
        if (top)
            gen_write(t, ti, s, idx % len);
        gen_pass(s + 1u);
        gen_write(t, ti, s + 1u, (idx + 1u) % len);
    }
    gen.cur_t[ti] = (uint8_t)gen_chord_at(ti, s, 0);
    if (ti == 0u)
        gen.cur_m = (uint8_t)((s / gen_master_period()) % (gen.llen ? gen.llen : 1u));
}

/* ---------------------------------------------------------------- MIDI out --- */
#ifdef FELUCCA_WEB
static uint32_t gen_web_mo[256], gen_web_mo_w, gen_web_mo_r;   /* the page reads them (web_midi_out) */
#endif
static void gen_midi(uint32_t pkt)
{
    midi_out_event(pkt);
#ifdef FELUCCA_WEB
    if (gen_web_mo_w - gen_web_mo_r < 256u)
        gen_web_mo[gen_web_mo_w++ % 256u] = pkt;
#endif
}
static uint32_t gen_drives(const track_t *t) { return gen.on && (uint32_t)(t - trk) < NPART; }
/* seq_step / seq_release: a sequenced note starts or ends */
static void gen_note_on(track_t *t, uint32_t note, uint32_t vel)
{
    uint32_t ti = (uint32_t)(t - trk), o;
    if (!gen_drives(t)) {
        trk_note_on(t, note, vel);
        return;
    }
    o = gen.tk[ti].out;
    if (o != GO_MIDI)
        trk_note_on(t, note, vel);
    if (o != GO_INT) {
        uint32_t mc = trk_midi_ch(ti);
        gen_midi(0x09u | (0x90u | mc) << 8 | (note & 127u) << 16 | (vel & 127u) << 24);
    }
}
static void gen_note_off(track_t *t, uint32_t note)
{
    uint32_t ti = (uint32_t)(t - trk), o;
    if (!gen_drives(t)) {
        trk_note_off(t, note);
        return;
    }
    o = gen.tk[ti].out;
    trk_note_off(t, note);                                     /* (harmless if it never started) */
    if (o != GO_INT) {
        uint32_t mc = trk_midi_ch(ti);
        gen_midi(0x08u | (0x80u | mc) << 8 | (note & 127u) << 16);
    }
}

/* MIDI in: CC 16 (any channel) turns the MACRO, 0..127 -> -100..100 (64: none). 1 = taken */
#define GEN_MACRO_CC 16u
static int gen_midi_cc(uint32_t cc, uint32_t value)
{
    if (!gen.on || cc != GEN_MACRO_CC)
        return 0;
    gen.macro = (int8_t)(value >= 64u ? (value - 64u) * 100u / 63u : -(int32_t)((64u - value) * 100u / 64u));
    return 1;
}

/* ------------------------------------------------------------------ defaults --- */
static void gen_defaults(void)
{
    static const gen_trk_t D[NPART] = {
        /* mult lock frz out mode     rhy      dens leap rest patch mute oct len dm: src rate depth  weight chance drift swing */
        {2, 0, 0, GO_BOTH, GD_3RD, GY_SUST, 50, 0, 0, 0, 0, 0, 16, 0, 3, 0, 60, 100, 0, 0},      /* dyad A: TINE EP */
        {3, 0, 0, GO_BOTH, GD_AUTO, GY_PULSE, 40, 0, 0, 4, 0, 0, 16, 0, 3, 0, 80, 100, 0, 0},    /* dyad B: PAD, x2 */
        {2, 1, 0, GO_BOTH, GB_R5, 0, 45, 0, 0, 2, 0, 0, 16, 0, 3, 0, 40, 100, 0, 0},             /* bass: FM BASS, locked */
        {2, 0, 0, GO_BOTH, GM_PASS, 0, 45, 25, 20, 7, 0, 0, 16, 0, 3, 0, 100, 100, 0, 0},         /* melody: PLUCK */
    };
    uint32_t i;
    gen.root = 0;
    gen.scale = 1;                       /* MAJ */
    gen.umask = 0xAB5u;                  /* major */
    gen.src = GS_MARKOV;
    gen.preset = 0;
    gen.plen = 4;
    gen.rate = 1;                        /* 1 bar */
    gen.mut = 20;
    gen.combine = GC_INDEP;
    gen.drift = 0;
    gen.macro = 0;
    for (i = 0; i < NPART; i++)
        gen.tk[i] = D[i];
    if (!gen.seed)
        gen.seed = 0x1F2E3D4Cu;
    gen_make_loop(0);
}
