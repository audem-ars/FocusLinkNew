#ifndef ZUTIL_RESTORE_H
#define ZUTIL_RESTORE_H

// Restore original macros
#ifdef ORIGINAL_FDOPEN
#undef fdopen
#define fdopen ORIGINAL_FDOPEN
#undef ORIGINAL_FDOPEN
#endif

#ifdef ORIGINAL_REMOVE
#undef remove
#define remove ORIGINAL_REMOVE
#undef ORIGINAL_REMOVE
#endif

#ifdef ORIGINAL_EOF
#undef EOF
#define EOF ORIGINAL_EOF
#undef ORIGINAL_EOF
#endif

#endif /* ZUTIL_RESTORE_H */