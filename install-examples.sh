#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/insites-io/insites-logic-engine"

usage() {
  cat <<EOF
Usage: $0 --opencode|--claude [OPTIONS]

Install example skills for OpenCode or Claude Code.

Target (required):
  --opencode    Install for OpenCode
  --claude      Install for Claude Code

Options:
  -g, --global  Install globally
  -l, --local   Install locally [default]
  -h, --help    Show this help message

Examples:
  $0 --opencode
  $0 --claude --global
  curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/install-examples.sh | bash -s -- --opencode
  curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/install-examples.sh | bash -s -- --claude --global
EOF
}

main() {
  local install_type="local"
  local target=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --opencode) target="opencode"; shift ;;
      --claude) target="claude"; shift ;;
      -g|--global) install_type="global"; shift ;;
      -l|--local) install_type="local"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
  done

  if [[ -z "$target" ]]; then
    echo "Error: Must specify --opencode or --claude"
    usage
    exit 1
  fi

  local target_dir
  if [[ "$target" == "opencode" ]]; then
    if [[ "$install_type" == "global" ]]; then
      target_dir="${HOME}/.config/opencode/skills"
    else
      target_dir=".opencode/skills"
    fi
  else
    if [[ "$install_type" == "global" ]]; then
      target_dir="${HOME}/.claude/skills"
    else
      target_dir=".claude/skills"
    fi
  fi

  echo "Installing example skills for ${target} (${install_type})..."

  # Create temp directory
  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' EXIT

  # Clone repo
  echo "Fetching skills..."
  git clone --depth 1 --quiet "$REPO_URL" "$tmp_dir"

  # Create target directory
  mkdir -p "$target_dir"

  # Copy each skill from skills_examples
  local count=0
  for skill_dir in "${tmp_dir}/skills_examples"/*; do
    if [[ -d "$skill_dir" ]]; then
      local skill_name
      skill_name=$(basename "$skill_dir")
      local dest_path="${target_dir}/${skill_name}"

      # Remove existing installation if present
      if [[ -d "$dest_path" ]]; then
        rm -rf "$dest_path"
      fi

      cp -r "$skill_dir" "$dest_path"
      echo "  Installed: ${skill_name}"
      count=$((count + 1))
    fi
  done

  echo "Installed ${count} skills to: ${target_dir}"
  echo "Done."
}

main "$@"
