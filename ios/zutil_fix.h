#ifndef ZUTIL_FIX_H
#define ZUTIL_FIX_H

// Save original macros
#ifdef fdopen
#define ORIGINAL_FDOPEN fdopen
#undef fdopen
#endif

#ifdef remove
#define ORIGINAL_REMOVE remove
#undef remove
#endif

#ifdef EOF
#define ORIGINAL_EOF EOF
#undef EOF
#endif

#endif /* ZUTIL_FIX_H */