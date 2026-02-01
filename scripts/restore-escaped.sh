#!/bin/bash
# Quick restore script to get back to working state

echo "Restoring escaped file versions..."

find ~/.opencode/universal/prompts -name "*.escaped" | while read file; do
  original="${file%.escaped}"
  mv "$file" "$original"
  echo "Restored: $(basename "$original")"
done

echo "✅ All files restored to JSON-escaped format"
