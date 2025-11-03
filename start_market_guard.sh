#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
VENV_DIR="${BACKEND_DIR}/.venv"

if [[ -z "${NVM_DIR:-}" ]] && [[ -d "$HOME/.nvm" ]]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
  # shellcheck disable=SC1090
  [[ -s "$NVM_DIR/bash_completion" ]] && source "$NVM_DIR/bash_completion"
fi

NPM_BIN="${NPM_BIN:-$(command -v npm || true)}"

if [[ -n "${NPM_BIN}" && "${NPM_BIN}" == /mnt/* && -x /usr/bin/npm ]]; then
  NPM_BIN="/usr/bin/npm"
fi

if [[ -z "${NPM_BIN}" || ! -x "${NPM_BIN}" ]]; then
  cat <<'MSG' >&2
[market-guard] npm が見つかりませんでした。WSL 内で下記を実行してください:
  sudo apt update
  sudo apt install nodejs npm
その後、frontend ディレクトリで npm install を実行してから再度スクリプトを起動してください。
MSG
  exit 1
fi

echo "[market-guard] Working directory: ${ROOT_DIR}"

if [[ ! -d "${BACKEND_DIR}" || ! -d "${FRONTEND_DIR}" ]]; then
  echo "[market-guard] backend/ または frontend/ が見つかりません。リポジトリ直下で実行してください。" >&2
  exit 1
fi

if [[ ! -f "${VENV_DIR}/bin/activate" ]]; then
  cat <<'MSG' >&2
[market-guard] Python 仮想環境 (.venv) が見つかりませんでした。
  1) cd backend
  2) python -m venv .venv
  3) source .venv/bin/activate
  4) pip install -r requirements.txt （存在する場合）または必要パッケージをインストール

上記を一度実行してから再度スクリプトを実行してください。
MSG
  exit 1
fi

source "${VENV_DIR}/bin/activate"

if lsof -ti:8000 >/dev/null 2>&1; then
  existing_pid="$(lsof -ti:8000 | tr '\n' ' ')"
  echo "[market-guard] Port 8000 is already in use by PID(s): ${existing_pid}. Stop the process and retry." >&2
  exit 1
fi

if lsof -ti:5173 >/dev/null 2>&1; then
  existing_pid_front="$(lsof -ti:5173 | tr '\n' ' ')"
  echo "[market-guard] Port 5173 is already in use by PID(s): ${existing_pid_front}. Stop the process and retry." >&2
  exit 1
fi

echo "[market-guard] Starting FastAPI backend (uvicorn)..."
cd "${BACKEND_DIR}"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
  echo
  echo "[market-guard] Stopping backend (PID: ${BACKEND_PID})..."
  kill "${BACKEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT

echo "[market-guard] Starting frontend dev server (npm run dev -- --host 0.0.0.0)..."
cd "${FRONTEND_DIR}"
"${NPM_BIN}" run dev -- --host 0.0.0.0
