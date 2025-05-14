#ifndef FixStdio_h
#define FixStdio_h

// Define FILE type before any other headers try to use it
#ifndef FILE
struct __sFILE;
typedef struct __sFILE FILE;
#endif

// Define size_t
#ifndef size_t
#ifdef __LP64__
typedef unsigned long size_t;
#else
typedef unsigned int size_t;
#endif
#endif

// Define EOF
#ifndef EOF
#define EOF (-1)
#endif

#endif /* FixStdio_h */
