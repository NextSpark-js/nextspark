# Sourced helper. On Windows (Git Bash), Node cannot open /g/... paths, so
# convert to a mixed path (C:/...); elsewhere, or without cygpath, unchanged.
node_path() {
    if command -v cygpath >/dev/null 2>&1; then
        cygpath -m "$1" 2>/dev/null || printf '%s\n' "$1"
    else
        printf '%s\n' "$1"
    fi
}
