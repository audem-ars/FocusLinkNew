#ifndef StdioFix_h
#define StdioFix_h

#ifdef __APPLE__
// Make sure stdio.h is properly included first
#include <stdio.h>
#include <stdlib.h>

// Define EOF if it's not defined
#ifndef EOF
#define EOF (-1)
#endif

// Make sure FILE is defined
#ifndef FILE
struct __sFILE;
typedef struct __sFILE FILE;
#endif

#endif // __APPLE__

#endif // StdioFix_h