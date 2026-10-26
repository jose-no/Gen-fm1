/* WASI build shim: hostsim's fork/pipe test paths are never reached in the browser */
#pragma once
#include <sys/types.h>
#define WEXITSTATUS(s) 0
#define WIFEXITED(s) 1
static inline pid_t waitpid(pid_t p, int *s, int o) { (void)p; (void)o; if (s) *s = 0; return -1; }
static inline pid_t wait(int *s) { if (s) *s = 0; return -1; }
static inline pid_t fork(void) { return -1; }
static inline int pipe(int fd[2]) { (void)fd; return -1; }
