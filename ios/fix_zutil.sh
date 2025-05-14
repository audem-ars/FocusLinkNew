#!/bin/bash
ZUTIL_FILE="Pods/gRPC-Core/third_party/zlib/zutil.h"

if [ -f "$ZUTIL_FILE" ]; then
  echo "Fixing $ZUTIL_FILE..."
  
  # Create a backup
  cp "$ZUTIL_FILE" "${ZUTIL_FILE}.backup"
  
  # Fix the problematic #define fdopen line
  sed -i '' 's/#define fdopen(fd,mode) NULL \/\* No fdopen() \*\//#if !defined(__APPLE__)\n#define fdopen(fd,mode) NULL \/\* No fdopen() \*\/\n#endif/g' "$ZUTIL_FILE"
  
  echo "Fixed successfully!"
else
  echo "File $ZUTIL_FILE not found!"
fi
