#ifndef gRPCFix_h
#define gRPCFix_h

// Undefine problematic macros that gRPC-Core might define
#ifdef fdopen
#undef fdopen
#endif

#endif /* gRPCFix_h */