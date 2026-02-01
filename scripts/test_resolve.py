#!/usr/bin/env python3
import json
import re
import os

HOME = os.environ.get("HOME", "/Users/benjaminerb")


def resolve_file_refs(content, depth=0):
    if depth > 10:
        return content

    pattern = r"\{file:([^}]+)\}"

    def replace_ref(match):
        filepath = match.group(1).replace("~", HOME)
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                file_content = f.read()
            # Recursively resolve
            file_content = resolve_file_refs(file_content, depth + 1)
            # Escape for JSON
            return (
                file_content.replace("\\", "\\\\")
                .replace('"', '\\"')
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
            )
        return match.group(0)

    return re.sub(pattern, replace_ref, content)


# Read and resolve
with open("/Users/benjaminerb/.config/opencode/opencode.json", "r") as f:
    config = f.read()

print("Original JSON size:", len(config))
print("Original JSON valid:", end=" ")

try:
    json.loads(config)
    print("YES")
except Exception as e:
    print(f"NO - {e}")

# Resolve file references
resolved = resolve_file_refs(config)
print(f"\nResolved size: {len(resolved)}")
print("Resolved JSON valid:", end=" ")

try:
    json.loads(resolved)
    print("YES ✅")
except json.JSONDecodeError as e:
    print(f"NO ❌")
    print(f"Error: {e}")
    print(f"Position: {e.pos}")

    # Show context
    start = max(0, e.pos - 50)
    end = min(len(resolved), e.pos + 50)
    print(f"Context: {repr(resolved[start:end])}")
