/* SPDX-License-Identifier: GPL-3.0-only */
/* The generator on the FM-1's own screen (Gen-FM1). Included after gen_setup.c (gen_get, gen_set, the store).
 *   ARP's taps  GEN 1..3 (the global settings; the panel: the progression and each track under its knob column), TRACK
 *               1..5 (the selected track's: ALGORITHM picks the track, as everywhere; the panel: its pattern as it is
 *               written). ARP's own pages follow, hidden while the generator runs (params.c, ui.c page_visible)
 *   SAVE's taps after PROJECT: SETUPS (SLOT, then CLEAR LOAD SAVE: the knob picks, OCT+ does it, as PROJECT) and POWER
 *               ON (what power-on does; RANDOM and DEFAULTS picked, OCT+; the generator on / off)
 * The cards are Felucca's: page_desc (params.c) asks gen_ui_desc for a setting's descriptor and a value to show (read
 * from the generator every time: a change from the control page or MIDI shows at once); a turn goes to gen_set
 * (gen_ui_commit). Names fit the cards: five characters */

#if FELUCCA_FLASH
static uint8_t persist_pending;                       /* (project.c: a settings save queued; a tentative definition) */
#endif

static const char *const GN_NOTE[12] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
static const char *const GN_SCALE[17] = {"CHR", "MAJ", "MIN", "DOR", "MIX", "PEN", "MPEN", "HARM", "PHRY", "LYD",
                                         "LOC", "MEL", "BLUES", "WHOLE", "DIMHW", "DIMWH", "USER"};
static const char *const GN_SRC[GS_COUNT] = {"FIXED", "WALK", "RULES", "FUNC", "CIRC", "VOICE", "PEND", "PEDAL"};
static const char *const GN_PRESET[6] = {"I-V", "ii-V", "vi-IV", "I-vi", "i-VII", "I-IV"};
static const char *const GN_RATE[13] = {"1/2", "1", "2", "3", "4", "5", "6", "7", "8", "12", "16", "24", "32"};
static const char *const GN_COMB[3] = {"INDEP", "MERGE", "CALL"};
static const char *const GN_TUNE[2] = {"432", "440"};
static const char *const GN_BOOT[2 + GEN_NSLOT] = {"RAND", "LAST", "SET 1", "SET 2", "SET 3", "SET 4", "SET 5",
                                                   "SET 6", "SET 7", "SET 8"};
static const char *const GN_PATCH[8] = {"TINE", "BELL", "BASS", "BRASS", "PAD", "MRMBA", "ORGAN", "PLUCK"};
static const char *const GN_DYAD[4] = {"3RDS", "5THS", "6THS", "AUTO"};
static const char *const GN_BASS[4] = {"ROOT", "R+5", "WALK", "OCT"};
static const char *const GN_MEL[3] = {"CHORD", "SCALE", "PASS"};
static const char *const GN_RHY[4] = {"SUST", "PULSE", "ARP", "EUCL"};
static const char *const GN_OUT[3] = {"BOTH", "SYNTH", "MIDI"};
static const char *const GN_MULT[7] = {"x1/4", "x1/2", "x1", "x2", "x3", "x4", "x8"};
static const char *const GN_DMSRC[GDM_COUNT] = {"OFF", "SINE", "TRI", "RAMP+", "RAMP-", "SQR", "RAND", "DRIFT"};
static const char *const GN_DMRATE[8] = {"1/4", "1/2", "1", "2", "4", "8", "16", "32"};
static const char *const GN_ONOFF[2] = {"OFF", "ON"};
static const char *const GN_TRK[NPART] = {"DYAD A", "DYAD B", "BASS", "MELODY"};

#define GD(l, f, mn, mx, df, n, u) {l, f, mn, mx, df, n, u}
static const param_desc_t GEN_GD_ON = GD("GEN", F_ENUM, 0, 1, 1, GN_ONOFF, 0);
static const param_desc_t GEN_GD_ROOT = GD("KEY", F_ENUM, 0, 11, 0, GN_NOTE, 0);
static const param_desc_t GEN_GD_SCALE = GD("SCALE", F_ENUM, 0, 16, 1, GN_SCALE, 0);
static const param_desc_t GEN_GD_SRC = GD("PROG", F_ENUM, 0, GS_COUNT - 1, GS_MARKOV, GN_SRC, 0);
static const param_desc_t GEN_GD_PRESET = GD("PRSET", F_ENUM, 0, 5, 0, GN_PRESET, 0);
static const param_desc_t GEN_GD_PLEN = GD("CHRDS", F_INT, 2, 8, 4, 0, 0);
static const param_desc_t GEN_GD_RATE = GD("RATE", F_ENUM, 0, 12, 1, GN_RATE, "BAR");
static const param_desc_t GEN_GD_MUT = GD("MUT", F_PCT, 0, 100, 20, 0, 0);
static const param_desc_t GEN_GD_COMB = GD("DYADB", F_ENUM, 0, 2, 0, GN_COMB, 0);
static const param_desc_t GEN_GD_MACRO = GD("MACRO", F_INT, -100, 100, 0, 0, 0);
static const param_desc_t GEN_GD_DRIFT = GD("DRIFT", F_PCT, 0, 100, 0, 0, 0);
static const param_desc_t GEN_GD_SWING = GD("SWING", F_PCT, 0, 100, 0, 0, 0);
static const param_desc_t GEN_GD_TUNE = GD("TUNE", F_ENUM, 0, 1, 0, GN_TUNE, "HZ");
static const param_desc_t GEN_GD_BOOT = GD("START", F_ENUM, 0, 1 + GEN_NSLOT, 0, GN_BOOT, 0);
static const param_desc_t GEN_GD_SLOT = GD("SLOT", F_INT, 1, GEN_NSLOT, 1, 0, 0);
static const param_desc_t GEN_GD_ACT[5] = {GD("CLEAR", F_INT, 0, 1, 0, 0, 0), GD("LOAD", F_INT, 0, 1, 0, 0, 0),
                                           GD("SAVE", F_INT, 0, 1, 0, 0, 0), GD("RAND", F_INT, 0, 1, 0, 0, 0),
                                           GD("DEFLT", F_INT, 0, 1, 0, 0, 0)};
/* a track's, by GK_* (the mode's names are the track's: gen_tdesc) */
static const param_desc_t GEN_TD[GK_N] = {
    [GK_MULT] = GD("RATE", F_ENUM, 0, GEN_NMULT - 1, 2, GN_MULT, 0),
    [GK_LOCK] = GD("LOCK", F_ENUM, 0, 1, 0, GN_ONOFF, 0),
    [GK_FREEZE] = GD("FREEZ", F_ENUM, 0, 1, 0, GN_ONOFF, 0),
    [GK_OUT] = GD("OUT", F_ENUM, 0, 2, 0, GN_OUT, 0),
    [GK_RHY] = GD("RHYTM", F_ENUM, 0, 3, 0, GN_RHY, 0),
    [GK_DENS] = GD("DENS", F_PCT, 0, 100, 45, 0, 0),
    [GK_OCT] = GD("OCT", F_INT, -2, 2, 0, 0, 0),
    [GK_LEAP] = GD("LEAP", F_PCT, 0, 100, 25, 0, 0),
    [GK_REST] = GD("REST", F_PCT, 0, 100, 20, 0, 0),
    [GK_PATCH] = GD("SOUND", F_ENUM, 0, 7, 0, GN_PATCH, 0),
    [GK_MUTE] = GD("MUTE", F_ENUM, 0, 1, 0, GN_ONOFF, 0),
    [GK_LEN] = GD("LEN", F_STEPS, 1, GEN_STEPS, GEN_STEPS, 0, 0),
    [GK_DMSRC] = GD("DMOD", F_ENUM, 0, GDM_COUNT - 1, 0, GN_DMSRC, 0),
    [GK_DMRATE] = GD("MRATE", F_ENUM, 0, 7, 3, GN_DMRATE, "BAR"),
    [GK_DMDEPTH] = GD("DEPTH", F_INT, -100, 100, 0, 0, 0),
    [GK_WEIGHT] = GD("WGHT", F_INT, -100, 100, 60, 0, 0),
    [GK_CHANCE] = GD("CHNCE", F_PCT, 1, 100, 100, 0, 0),
    [GK_DRIFT] = GD("DRIFT", F_PCT, 0, 100, 0, 0, 0),
    [GK_SWING] = GD("SWING", F_PCT, 0, 100, 0, 0, 0),
};
static const param_desc_t GEN_TD_MODE[3] = {GD("INTVL", F_ENUM, 0, 3, 0, GN_DYAD, 0),
                                            GD("PATT", F_ENUM, 0, 3, 1, GN_BASS, 0),
                                            GD("POOL", F_ENUM, 0, 2, 2, GN_MEL, 0)};

static const param_desc_t *gen_gdesc(uint32_t id)
{
    switch (id) {
    case GP_ON: return &GEN_GD_ON;
    case GP_ROOT: return &GEN_GD_ROOT;
    case GP_SCALE: return &GEN_GD_SCALE;
    case GP_SRC: return &GEN_GD_SRC;
    case GP_PRESET: return &GEN_GD_PRESET;
    case GP_PLEN: return &GEN_GD_PLEN;
    case GP_RATE: return &GEN_GD_RATE;
    case GP_MUT: return &GEN_GD_MUT;
    case GP_COMBINE: return &GEN_GD_COMB;
    case GP_MACRO: return &GEN_GD_MACRO;
    case GP_DRIFT: return &GEN_GD_DRIFT;
    case GP_SWING: return &GEN_GD_SWING;
    case GP_TUNE: return &GEN_GD_TUNE;
    case GP_BOOT: return &GEN_GD_BOOT;
    default: return 0;
    }
}
static const param_desc_t *gen_tdesc(uint32_t ti, uint32_t k)
{
    if (k == GK_MODE)
        return &GEN_TD_MODE[ti < GT_BASS ? 0 : ti == GT_BASS ? 1 : 2];
    if ((k == GK_RHY && ti >= GT_BASS) || ((k == GK_LEAP || k == GK_REST) && ti != GT_MEL))
        return 0;
    return k < GK_N && GEN_TD[k].label ? &GEN_TD[k] : 0;
}

/* the values the cards show: read from the generator each time (gen_get), the UI's own after them */
#define GEN_UI_N (GP_TRK + NPART * GK_N)
#define GEN_UI_SLOTV GEN_UI_N                        /* SETUPS' SLOT */
#define GEN_UI_ACTV (GEN_UI_N + 1)                   /* an action column (no value) */
static int16_t gen_ui_v[GEN_UI_N + 2];
static uint8_t gen_ui_slot = 1;                       /* SETUPS: the slot picked, 1..8 */

static const param_desc_t *gen_ui_desc(uint32_t pid, int16_t **valp)
{
    uint32_t ti = song.sel % NPART, id;
    const param_desc_t *d;
    int32_t v;
    *valp = 0;
    if (pid == GEN_U_SLOT) {
        gen_ui_v[GEN_UI_SLOTV] = gen_ui_slot;
        *valp = &gen_ui_v[GEN_UI_SLOTV];
        return &GEN_GD_SLOT;
    }
    if (pid >= GEN_U_CLEAR && pid <= GEN_U_DEFAULTS) {
        gen_ui_v[GEN_UI_ACTV] = 0;
        *valp = &gen_ui_v[GEN_UI_ACTV];
        return &GEN_GD_ACT[pid - GEN_U_CLEAR];
    }
    if (pid == GEN_U_RHYLEAP)                         /* the dyads' RHYTHM, the melody's LEAP, the bass: none */
        pid = ti < GT_BASS ? GEN_T | GK_RHY : ti == GT_MEL ? GEN_T | GK_LEAP : 0xFFu;
    else if (pid == GEN_U_REST)
        pid = ti == GT_MEL ? GEN_T | GK_REST : 0xFFu;
    if (pid == 0xFFu)
        return 0;
    if (pid & GEN_T) {
        uint32_t k = pid & 0x3Fu;
        id = GP_TRK + ti * GK_N + k;
        d = gen_tdesc(ti, k);
    } else {
        id = pid;
        d = gen_gdesc(pid);
    }
    if (!d || id >= GEN_UI_N)
        return 0;
    v = gen_get(id);
    if (id == GP_TUNE)
        v = v == 440;
    gen_ui_v[id] = (int16_t)v;
    *valp = &gen_ui_v[id];
    return d;
}

/* a knob turned on a GEN page: the value param_turn left in the card's slot, to the generator */
static void gen_ui_commit(const int16_t *vp)
{
    uint32_t id = (uint32_t)(vp - gen_ui_v);
    int32_t v = *vp;
    if (id == GEN_UI_SLOTV) {
        gen_ui_slot = (uint8_t)clamp(v, 1, (int32_t)GEN_NSLOT);
        return;
    }
    if (id >= GEN_UI_N)
        return;
    if (id == GP_TUNE) {
        gen_set(GP_TUNE, v ? 440 : 432);
        return;
    }
    if (id == GP_BOOT) {                              /* START: the saved setups only (an empty slot is passed over) */
        int32_t was = gen_store.boot, dir = v > was ? 1 : -1;
        while (v >= (int32_t)GBOOT_SLOT0 && v < (int32_t)(GBOOT_SLOT0 + GEN_NSLOT) &&
               !gen_store.slot[v - (int32_t)GBOOT_SLOT0].used)
            v += dir;
        if (v < 0 || v >= (int32_t)(GBOOT_SLOT0 + GEN_NSLOT))
            v = was;
    }
    gen_set(id, v);
}

/* ------------------------------------------------------------------ actions --- */
static uint32_t gen_act_cols(uint32_t graph) { return graph == GR_GENSET ? 14u : 6u; }   /* SETUPS 2..4, POWER ON 2..3 */
static const char *gen_act_name(uint32_t c)
{
    static const char *const SET[4] = {"", "CLEAR", "LOAD", "SAVE"}, *const ACT[4] = {"", "RANDOMIZE", "DEFAULTS", ""};
    return cur_page()->graph == GR_GENSET ? SET[c & 3u] : ACT[c & 3u];
}
static int gen_slot_used(uint32_t n) { return n >= 1u && n <= GEN_NSLOT && gen_store.slot[n - 1u].used; }
static int gen_act_ready(uint32_t c)
{
    if (cur_page()->graph == GR_GENACT)
        return 1;
    return c == 3u || gen_slot_used(gen_ui_slot);    /* SAVE always; CLEAR and LOAD a saved one */
}
static void gen_saved_msg(const char *a, uint32_t n)
{
    char b[24];
    str_cpy(b, a, sizeof b);
    fmt_int(b + str_len(b), (int32_t)n);
    ui_message(b);
}
static void gen_act_do(uint32_t c)
{
    uint32_t n = gen_ui_slot;
    if (cur_page()->graph == GR_GENACT) {
        ui.act = 0;
        if (c == 1u) {                                /* RANDOMIZE: a new setup at once (no dialog: that is the point) */
            gen_set(GP_RANDOM, (int32_t)(fm1_ms * 2654435761u >> 1));
            ui_message("NEW SETUP");
        } else if (c == 2u) {
            confirm_open(CF_GEN_DEFAULTS, 0);
        }
        ui.force = 1;
        return;
    }
    if (c == 2u) {                                    /* LOAD stays picked (load another, again) */
        if (!gen_slot_used(n)) {
            ui_message("EMPTY SLOT");
            return;
        }
        gen_set(GP_LOAD, (int32_t)n);
        gen_saved_msg("PLAYING SETUP ", n);
        ui.force = 1;
        return;
    }
    ui.act = 0;
    if (c == 1u) {
        if (gen_slot_used(n))
            confirm_open(CF_GEN_CLEAR, n);
        else
            ui_message("EMPTY SLOT");
    } else if (c == 3u) {
        if (gen_slot_used(n)) {
            confirm_open(CF_GEN_SAVE, n);
        } else {
            gen_set(GP_SAVE, (int32_t)n);
            gen_saved_msg("SAVED AS SETUP ", n);
        }
    }
    ui.force = 1;
}
static void gen_confirm_text(uint32_t kind, uint32_t k, char *a, char *b)
{
    b[0] = 0;
    if (kind == CF_GEN_DEFAULTS) {
        str_cpy(a, "RESET GENERATOR?", 24);
        str_cpy(b, "ALL TO THE DEFAULTS", 24);
        return;
    }
    str_cpy(a, kind == CF_GEN_SAVE ? "REPLACE SETUP 1?" : "CLEAR SETUP 1?", 24);
    a[str_len(a) - 2u] = (char)('0' + k % 10u);
}
static void gen_confirm_do(uint32_t kind, uint32_t k)
{
    if (kind == CF_GEN_DEFAULTS) {
        gen_set(GP_DEFAULTS, 1);
        ui_message("GENERATOR RESET");
    } else if (kind == CF_GEN_SAVE) {
        gen_set(GP_SAVE, (int32_t)k);
        gen_saved_msg("REPLACED SETUP ", k);
    } else {
        gen_set(GP_CLEAR, (int32_t)k);
        gen_saved_msg("CLEARED SETUP ", k);
    }
}

/* ------------------------------------------------------------------- chords --- */
/* degree d's chord (every other note of the scale from d): its name ("C#m7") and numeral ("vii"), 8 bytes each */
static void gen_chord(int32_t d, char *name, char *roman)
{
    static const struct { int8_t a, b; const char *suf; uint8_t minor; } SH[] = {
        {4, 7, "", 0}, {3, 7, "m", 1}, {3, 6, "dim", 1}, {4, 8, "+", 0}, {5, 7, "sus4", 0}, {2, 7, "sus2", 0},
        {4, 9, "6", 0}, {3, 9, "m6", 1}, {4, 10, "7", 0}, {3, 10, "m7", 1}, {4, 11, "M7", 0}, {5, 10, "7s4", 0},
        {2, 10, "7s2", 0}, {5, 9, "6s4", 0}, {2, 9, "6s2", 0}};
    static const char *const RN[12] = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"};
    uint8_t pc[12];
    int32_t n = (int32_t)gen_pcs(pc), q, r, a, b, root;
    uint32_t i, minor = 0;
    const char *suf = "?";
#define GEN_AT(x) (pc[(((x) % n) + n) % n] + 12 * ((x) >= 0 ? (x) / n : -((-(x) + n - 1) / n)))
    r = GEN_AT(d);
    a = GEN_AT(d + 2) - r;
    b = GEN_AT(d + 4) - r;
#undef GEN_AT
    for (i = 0; i < sizeof SH / sizeof SH[0]; i++)
        if (SH[i].a == a && SH[i].b == b) {
            suf = SH[i].suf;
            minor = SH[i].minor;
            break;
        }
    root = ((int32_t)gen.root + r) % 12;
    str_cpy(name, GN_NOTE[root], 8);
    str_cpy(name + str_len(name), suf, 8 - str_len(name));
    q = ((d % n) + n) % n;
    str_cpy(roman, RN[q % 12], 8);
    if (minor)                                       /* minor and diminished: lower case */
        for (i = 0; roman[i]; i++)
            roman[i] = (char)(roman[i] + 32);
}

/* ------------------------------------------------------------------- panels --- */
static uint32_t gen_steps_sig(uint32_t ti)
{
    uint32_t h = 2166136261u, i;
    for (i = 0; i < GEN_STEPS; i++) {
        const step_t *s = &trk[ti].step[i];
        h = (h ^ (uint32_t)(s->time | s->n << 2 | s->note[0] << 8 | s->note[1] << 16)) * 16777619u;
        h = (h ^ s->probability) * 16777619u;
    }
    return h;
}
static uint32_t gen_graph_sig(uint32_t graph)
{
    uint32_t h = 2166136261u, i, ti = song.sel % NPART;
#define GH(x) (h = (h ^ (uint32_t)(x)) * 16777619u)
    GH(graph);
    GH(gen.on);
    GH(song.playing);
    if (graph == GR_GEN) {
        GH(gen.root);
        GH(gen.scale);
        GH(gen_mask());
        GH(gen.src);
        GH(gen.llen);
        GH(gen.cur_m);
        for (i = 0; i < GEN_LOOP_MAX; i++)
            GH(gen.loop[i]);
        for (i = 0; i < NPART; i++) {
            GH(gen.cur_t[i]);
            GH(song.playing ? trk[i].seq_idx : 0xFFFFu);
            GH(gen_len(i));
            GH(gen.tk[i].mute | gen.tk[i].freeze << 1);
            GH(gen.llen ? gen_dens(i, gen.pos[i]) : 0u);
        }
    } else if (graph == GR_GENTRK) {
        GH(ti);
        GH(gen_steps_sig(ti));
        GH(song.playing ? trk[ti].seq_idx : 0xFFFFu);
        GH(gen_len(ti));
        GH(gen.cur_t[ti]);
        GH(gen.llen ? gen_dens(ti, gen.pos[ti]) : 0u);
        GH(gen.tk[ti].freeze);
        GH(gen.root);
    } else if (graph == GR_GENSET) {
        GH(gen_slots());
        GH(gen_store.boot);
        GH(gen_ui_slot);
        GH(gen_dirty);
#if FELUCCA_FLASH
        GH(persist_pending);
#endif
    } else {
        GH(gen_store.boot);
        GH(ui.act);
    }
#undef GH
    return h;
}

/* GEN: the progression (the master's chord in the theme), then each track under its knob column: its number, the
 * chord it plays, its steps (the one playing lit) and its density now */
static void gen_graph_prog(void)
{
    char name[8], roman[8], b[24];
    uint32_t i, n = gen.llen ? gen.llen : 1u, per = n > 8u ? (n + 1u) / 2u : n, rows = n > 8u ? 2u : 1u;
    int32_t gh = (int32_t)graph_h(), w, ch = rows == 1u ? 34 : 22, y0 = 22;
    if (per < 4u)
        per = 4u;
    w = (228 - ((int32_t)per - 1) * 3) / (int32_t)per;
    str_cpy(b, GN_NOTE[gen.root % 12u], sizeof b);
    str_cpy(b + str_len(b), " ", 2);
    str_cpy(b + str_len(b), GN_SCALE[gen.scale % 17u], 8);
    cv_text(10, 4, &AF_S, b, T_MID);
    cv_text_r(230, 4, &AF_S, gen.on ? GN_SRC[gen.src % GS_COUNT] : "GENERATOR OFF", gen.on ? T_MID : T_ACCENT, T_SURF);
    for (i = 0; i < n && i < GEN_LOOP_MAX; i++) {
        int32_t x = 6 + (int32_t)(i % per) * (w + 3), y = y0 + (int32_t)(i / per) * (ch + 3);
        int m = song.playing && i == gen.cur_m;
        uint16_t bg = m ? T_THEME : T_BG, fg = m ? T_INK : T_TEXT;
        gen_chord(gen.loop[i], name, roman);
        cv_rrect(x, y, w, ch, 4, bg, T_SURF);
        cv_text_in(x, y + 3, w, w >= text_w(&AF_M, name) + 4 ? &AF_M : &AF_S, name, fg, bg);
        if (rows == 1u)
            cv_text_in(x, y + 20, w, &AF_S, roman, m ? T_INK : T_MID, bg);
    }
    for (i = 0; i < NPART; i++) {                    /* the four tracks, under KNOB 1..4 */
        int32_t x = 6 + (int32_t)i * 57, y = y0 + (int32_t)rows * (ch + 3) + 4, k, len = (int32_t)gen_len(i);
        int32_t sw = 52 / len > 6 ? 6 : 52 / len, dn = gen.llen ? (int32_t)gen_dens(i, gen.pos[i]) : 0;
        char tn[4] = {(char)('1' + i), 0, 0, 0};
        cv_text(x + 1, y, &AF_S, tn, i == song.sel % NPART ? T_ACCENT : T_MID);
        if (gen.tk[i].mute)
            cv_text(x + 12, y, &AF_S, "MUTE", T_DIM);
        else if (song.playing) {
            gen_chord(gen.loop[gen.cur_t[i] % GEN_LOOP_MAX], name, roman);
            cv_text(x + 12, y, &AF_S, name, gen.cur_t[i] == gen.cur_m ? T_TEXT : T_ACCENT);
        } else {
            cv_text(x + 12, y, &AF_S, gen.tk[i].freeze ? "FROZEN" : GN_TRK[i], T_DIM);
        }
        for (k = 0; k < len; k++) {                  /* its steps: a note, a tie, a rest; the one playing */
            const step_t *s = &trk[i].step[k];
            int on = song.playing && (int32_t)trk[i].seq_idx % len == k;
            uint16_t c = on ? T_THEME : s->time == ST_NOTE ? T_TEXT : s->time == ST_TIE ? T_MID : T_DIM;
            cv_rect(x + 1 + k * sw, y + 18 + (on ? 0 : 2), sw - 1, on ? 8 : 4, c);
        }
        cv_rect(x + 1, y + 30, 52, 3, T_BG);         /* its density now */
        cv_rect(x + 1, y + 30, 52 * dn / 100, 3, T_MID);
    }
    (void)gh;
}

/* TRACK: the selected track's pattern as it is written (a roll: the notes over the steps, the one playing lit), with
 * its role, the chord it plays and its density */
static void gen_graph_track(void)
{
    uint32_t ti = song.sel % NPART;
    const track_t *t = &trk[ti];
    int32_t len = (int32_t)gen_len(ti), k, lo = 127, hi = 0, gh = (int32_t)graph_h(), y0 = 22, rh = gh - y0 - 20;
    int32_t cw = 226 / len, x0 = 7;
    char name[8], roman[8], b[24];
    for (k = 0; k < len; k++) {
        const step_t *s = &t->step[k];
        uint32_t j;
        for (j = 0; s->time == ST_NOTE && j < s->n && j < 4u; j++) {
            lo = s->note[j] < lo ? s->note[j] : lo;
            hi = s->note[j] > hi ? s->note[j] : hi;
        }
    }
    if (lo > hi) {
        lo = 48;
        hi = 72;
    }
    if (hi - lo < 12) {
        lo = (lo + hi) / 2 - 6;
        hi = lo + 12;
    }
    cv_text(10, 4, &AF_S, GN_TRK[ti], T_MID);
    if (song.playing && gen.llen) {
        gen_chord(gen.loop[gen.cur_t[ti] % GEN_LOOP_MAX], name, roman);
        str_cpy(b, name, sizeof b);
        str_cpy(b + str_len(b), "  ", 3);
        str_cpy(b + str_len(b), roman, 8);
        cv_text_r(230, 4, &AF_S, b, T_TEXT, T_SURF);
    } else {
        cv_text_r(230, 4, &AF_S, gen.tk[ti].freeze ? "FROZEN" : gen.tk[ti].mute ? "MUTED" : "", T_ACCENT, T_SURF);
    }
    cv_rect(x0, y0, cw * len, rh, T_BG);
    if (!song.playing && lo == 48 && hi == 60)        /* (nothing written yet: it writes as it plays) */
        cv_text_in(x0, y0 + rh / 2 - 6, cw * len, &AF_S, gen.on ? "WRITES AS IT PLAYS: [PLAY]" : "THE GENERATOR IS OFF",
                   T_MID, T_BG);
    for (k = 0; k < len; k++) {
        const step_t *s = &t->step[k];
        int on = song.playing && (int32_t)t->seq_idx % len == k;
        uint32_t j;
        if (on)
            cv_rect(x0 + k * cw, y0, cw, rh, T_DIM);
        if (k % 4 == 0)
            cv_rect(x0 + k * cw, y0 + rh, 1, 3, T_MID);
        for (j = 0; s->time == ST_NOTE && j < s->n && j < 4u; j++) {
            int32_t y = y0 + rh - 4 - (s->note[j] - lo) * (rh - 6) / (hi - lo);
            uint16_t c = on ? T_ACCENT : step_chance(s) < 100u ? T_MID : T_THEME;
            int32_t w = cw - 2, k2;
            for (k2 = k + 1; k2 < len && t->step[k2].time == ST_TIE; k2++)   /* held through its ties */
                w += cw;
            cv_rrect(x0 + k * cw + 1, y, w, 4, 1, c, T_BG);
        }
    }
    {
        int32_t dn = gen.llen ? (int32_t)gen_dens(ti, gen.pos[ti]) : 0;
        str_cpy(b, "DENSITY ", sizeof b);
        fmt_int(b + str_len(b), dn);
        str_cpy(b + str_len(b), "%", 2);
        cv_text(10, gh - 15, &AF_S, b, T_MID);
        str_cpy(b, "LEN ", sizeof b);
        fmt_int(b + str_len(b), len);
        cv_text_r(230, gh - 15, &AF_S, b, T_MID, T_SURF);
    }
}

/* SETUPS: the eight slots, two columns of four (the one picked in the theme), the one power-on starts from marked; a save
 * waiting for STOP said under them */
static void gen_graph_setups(void)
{
    uint32_t i;
    int32_t gh = (int32_t)graph_h();
    for (i = 0; i < GEN_NSLOT; i++) {
        int32_t x = 6 + (int32_t)(i / 4u) * 115, y = 4 + (int32_t)(i % 4u) * 23;
        int sel = i + 1u == gen_ui_slot, used = gen_store.slot[i].used != 0u;
        uint16_t bg = sel ? T_THEME : T_SURF;
        char tag[4] = {(char)('1' + i), 0, 0, 0};
        if (sel)
            cv_rrect(x, y, 112, 20, 4, T_THEME, T_SURF);
        cv_text_on(x + 8, y + 3, &AF_M, tag, sel ? T_INK : T_MID, bg);
        cv_text_on(x + 26, y + 4, &AF_S, used ? "SAVED" : "--", sel ? T_INK : used ? T_TEXT : T_DIM, bg);
        if (gen_store.boot == GBOOT_SLOT0 + i)
            cv_text_r(x + 106, y + 4, &AF_S, "START", sel ? T_INK : T_ACCENT, bg);
    }
    if (gen_dirty
#if FELUCCA_FLASH
        || persist_pending
#endif
    )
        cv_text_in(0, gh - 16, 240, &AF_S, song.playing ? "STORED WHEN PLAYBACK STOPS" : "STORING...", T_ACCENT, T_SURF);
}

/* POWER ON: what power-on does, and the action picked */
static void gen_graph_power(void)
{
    char b[24];
    static const char *const BOOT_LONG[2] = {"A NEW RANDOM SETUP", "THE LAST SESSION"};
    str_cpy(b, gen_store.boot >= GBOOT_SLOT0 ? "SETUP 1" : BOOT_LONG[gen_store.boot & 1u], sizeof b);
    if (gen_store.boot >= GBOOT_SLOT0)
        b[6] = (char)('1' + (gen_store.boot - GBOOT_SLOT0));
    cv_text_in(0, 14, 240, &AF_S, "AT POWER-ON THE GENERATOR PLAYS", T_MID, T_SURF);
    cv_text_in(0, 32, 240, &AF_M, b, T_TEXT, T_SURF);
    if (!gen.on)
        note_line(62, "THE GENERATOR IS OFF", T_ACCENT);
    else
        note_line(62, ui.act == 2u ? "[OCT+] A NEW SETUP NOW" : ui.act == 3u ? "[OCT+] BACK TO THE DEFAULTS" :
                  "TURN RAND OR DEFLT TO PICK", T_MID);
    note_line(84, "[ARP] HOLD: KEY, NEW SETUP", T_DIM);
}

static void gen_graph(uint32_t graph, const struct track *t)
{
    (void)t;
    if (graph == GR_GEN)
        gen_graph_prog();
    else if (graph == GR_GENTRK)
        gen_graph_track();
    else if (graph == GR_GENSET)
        gen_graph_setups();
    else
        gen_graph_power();
}

/* ---------------------------------------------------- ARP held: the quick layer --- */
static gen_setup_t gen_ly_snap;                       /* the generator as the layer opened (OCT- puts it back) */
static void gen_ly_open(void) { gen_capture(&gen_ly_snap); }
static void gen_ly_key(uint32_t k)
{
    char b[16];
    gen_set(GP_ROOT, (int32_t)((k + 5u) % 12u));      /* the key's note name (F3 = F), as SCL's */
    str_cpy(b, "KEY ", sizeof b);
    str_cpy(b + str_len(b), GN_NOTE[gen.root % 12u], 4);
    ui_message(b);
}
static void gen_ly_putback(void)
{
    gen_restore(&gen_ly_snap);
    gen_apply_tracks();
    ui_message("GENERATOR PUT BACK");
}
static void gen_ly_random(void)
{
    gen_set(GP_RANDOM, (int32_t)(fm1_ms * 2654435761u >> 1));
    ui_message("NEW SETUP");
}
/* the map: the twelve notes as the keys give them (the key's lit, its scale's in the theme, the others dim), and the
 * progression under them */
static void gen_ly_map(void)
{
    static const uint8_t ORDER[12] = {5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4};   /* F .. E: the keyboard from F3 */
    uint32_t i, m = gen_mask();
    char name[8], roman[8], b[40];
    for (i = 0; i < 12u; i++) {
        uint32_t pcl = ORDER[i], e = (pcl + 12u - gen.root % 12u) % 12u;
        int32_t x = 7 + (int32_t)(i % 6u) * 38, y = 4 + (int32_t)(i / 6u) * 26;
        uint16_t fill = e == 0u ? T_THEME : (m >> e) & 1u ? T_BG : T_SURF, ink = e == 0u ? T_INK : (m >> e) & 1u ? T_TEXT : T_DIM;
        cv_rrect(x, y, 34, 22, 4, fill, T_SURF);
        cv_text_in(x, y + 4, 34, &AF_M, GN_NOTE[pcl], ink, fill);
    }
    b[0] = 0;
    for (i = 0; i < gen.llen && i < 8u; i++) {
        gen_chord(gen.loop[i], name, roman);
        uint32_t was = str_len(b);
        if (was + str_len(name) + 2u >= sizeof b)
            break;
        if (i)
            str_cpy(b + was, "  ", 3);
        str_cpy(b + str_len(b), name, 8);
        if (text_w(&AF_M, b) > 222) {                 /* (as many as fit the panel) */
            b[was] = 0;
            break;
        }
    }
    cv_text_in(0, 64, 240, &AF_M, b, T_TEXT, T_SURF);
    str_cpy(b, GN_NOTE[gen.root % 12u], sizeof b);
    str_cpy(b + str_len(b), " ", 2);
    str_cpy(b + str_len(b), GN_SCALE[gen.scale % 17u], 8);
    str_cpy(b + str_len(b), "  ", 3);
    str_cpy(b + str_len(b), GN_SRC[gen.src % GS_COUNT], 8);
    cv_text_in(0, 86, 240, &AF_S, b, T_MID, T_SURF);
}
