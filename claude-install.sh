#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/insites-io/insites-logic-engine"
SKILL_NAME="insites"

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Install the Insites skill for Claude Code.

Options:
  -g, --global    Install globally (~/.claude/skills/)
  -l, --local     Install locally (.claude/skills/) [default]
  -h, --help      Show this help message

Examples:
  curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/claude-install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/insites-io/insites-logic-engine/master/claude-install.sh | bash -s -- --global
EOF
}

main() {
  local install_type="local"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -g|--global) install_type="global"; shift ;;
      -l|--local) install_type="local"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
  done

  local target_dir
  if [[ "$install_type" == "global" ]]; then
    target_dir="${HOME}/.claude/skills"
  else
    target_dir=".claude/skills"
  fi

  local skill_path="${target_dir}/${SKILL_NAME}"

  local command_dir
  if [[ "$install_type" == "global" ]]; then
    command_dir="${HOME}/.claude/commands"
  else
    command_dir=".claude/commands"
  fi

  echo "Installing ${SKILL_NAME} skill for Claude Code (${install_type})..."

  # Create temp directory
  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap 'rm -rf "${tmp_dir:-}"' EXIT

  # Clone repo
  echo "Fetching skill..."
  git clone --depth 1 --quiet "$REPO_URL" "$tmp_dir"

  # Create target directory
  mkdir -p "$target_dir"

  # Remove existing installation if present
  if [[ -d "$skill_path" ]]; then
    echo "Updating existing installation..."
    rm -rf "$skill_path"
  fi

  # Copy skill
  cp -r "${tmp_dir}/skills/${SKILL_NAME}" "$skill_path"

  # Install command
  mkdir -p "$command_dir"
  local command_path="${command_dir}/${SKILL_NAME}.md"
  if [[ -d "$command_path" ]] || [[ -f "$command_path" ]]; then
    rm -rf "$command_path"
  fi
  cp "${tmp_dir}/command/${SKILL_NAME}.md" "$command_path"

  echo "Installed skill to: ${skill_path}"
  echo "Installed command to: ${command_path}"
  echo "Done."
}

main "$@"
